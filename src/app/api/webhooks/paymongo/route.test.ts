import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "whsk_test";
const db = {
  insertError: null as { code: string } | null,
  rpc: vi.fn(),
  deleted: vi.fn(),
};
const notify = vi.fn();

vi.mock("@/lib/env.server", () => ({
  getServerEnv: () => ({ PAYMONGO_WEBHOOK_SECRET: SECRET }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: async () => ({ error: db.insertError }),
      delete: () => ({ eq: async (...args: unknown[]) => db.deleted(...args) }),
    }),
    rpc: (...args: unknown[]) => ({ single: async () => db.rpc(...args) }),
  }),
}));
vi.mock("@/server/queries/booking-record", () => ({
  loadBookingRecord: async () => ({ id: "b-1" }),
}));
vi.mock("@/server/booking-notifications", () => ({ notifyBookingReceived: notify }));

const { POST } = await import("./route");

const event = {
  data: {
    id: "evt_1",
    attributes: {
      type: "checkout_session.payment.paid",
      livemode: false,
      data: {
        id: "cs_1",
        attributes: {
          reference_number: "BK-2026-ABC123",
          payments: [{ id: "pay_1", attributes: { amount: 105000 } }],
        },
      },
    },
  },
};

function request(body: unknown, secret = SECRET) {
  const raw = JSON.stringify(body);
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return new Request("http://localhost/api/webhooks/paymongo", {
    method: "POST",
    headers: { "Paymongo-Signature": `t=${t},te=${sig},li=` },
    body: raw,
  });
}

beforeEach(() => {
  db.insertError = null;
  db.rpc.mockReset().mockResolvedValue({
    data: { booking_id: "b-1", outcome: "paid" },
    error: null,
  });
  db.deleted.mockReset().mockResolvedValue({ error: null });
  notify.mockReset();
});

describe("PayMongo webhook", () => {
  it("rejects a request whose signature doesn't match", async () => {
    const res = await POST(request(event, "wrong-secret"));
    expect(res.status).toBe(401);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("settles a paid checkout once and emails the client and studio", async () => {
    const res = await POST(request(event));
    expect(res.status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("mark_booking_paid", {
      p_reference: "BK-2026-ABC123",
      p_checkout_id: "cs_1",
      p_payment_id: "pay_1",
      p_amount_cents: 105000,
      p_raw: event,
    });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("acknowledges a repeated event without settling it again", async () => {
    db.insertError = { code: "23505" };
    const res = await POST(request(event));
    expect(res.status).toBe(200);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("ignores events it doesn't handle", async () => {
    const other = structuredClone(event);
    other.data.attributes.type = "payment.failed";
    const res = await POST(request(other));
    expect(res.status).toBe(200);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("forgets the event and asks PayMongo to retry when settling fails", async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(request(event));
    expect(res.status).toBe(500);
    expect(db.deleted).toHaveBeenCalledWith("event_id", "evt_1");
  });
});
