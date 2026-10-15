import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parsePaidEvent, verifyWebhookSignature } from "./paymongo";

const SECRET = "whsk_test_secret";
const BODY = JSON.stringify({ data: { id: "evt_1" } });
const NOW = 1_800_000_000;
const sign = (body: string, t: number, secret = SECRET) =>
  createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");

describe("verifyWebhookSignature", () => {
  it("accepts a test-mode event signed with the webhook secret", () => {
    const header = `t=${NOW},te=${sign(BODY, NOW)},li=`;
    expect(verifyWebhookSignature(BODY, header, SECRET, false, NOW)).toBe(true);
  });

  it("checks the live signature for live events", () => {
    const header = `t=${NOW},te=,li=${sign(BODY, NOW)}`;
    expect(verifyWebhookSignature(BODY, header, SECRET, true, NOW)).toBe(true);
    expect(verifyWebhookSignature(BODY, header, SECRET, false, NOW)).toBe(false);
  });

  it("rejects a wrong secret, a changed body, a stale timestamp and a malformed header", () => {
    expect(
      verifyWebhookSignature(
        BODY,
        `t=${NOW},te=${sign(BODY, NOW, "nope")},li=`,
        SECRET,
        false,
        NOW,
      ),
    ).toBe(false);
    expect(
      verifyWebhookSignature(`${BODY} `, `t=${NOW},te=${sign(BODY, NOW)},li=`, SECRET, false, NOW),
    ).toBe(false);
    const old = NOW - 301;
    expect(
      verifyWebhookSignature(BODY, `t=${old},te=${sign(BODY, old)},li=`, SECRET, false, NOW),
    ).toBe(false);
    expect(verifyWebhookSignature(BODY, null, SECRET, false, NOW)).toBe(false);
    expect(verifyWebhookSignature(BODY, "garbage", SECRET, false, NOW)).toBe(false);
  });
});

describe("parsePaidEvent", () => {
  const event = {
    data: {
      id: "evt_123",
      type: "event",
      attributes: {
        type: "checkout_session.payment.paid",
        livemode: false,
        data: {
          id: "cs_abc",
          type: "checkout_session",
          attributes: {
            reference_number: "BK-2026-ABC123",
            payments: [{ id: "pay_xyz", type: "payment", attributes: { amount: 105000 } }],
          },
        },
      },
    },
  };

  it("reads the booking reference and payment from a paid checkout event", () => {
    expect(parsePaidEvent(event)).toEqual({
      eventId: "evt_123",
      livemode: false,
      checkoutId: "cs_abc",
      reference: "BK-2026-ABC123",
      paymentId: "pay_xyz",
      amountCents: 105000,
    });
  });

  it("ignores other events and malformed bodies", () => {
    const other = structuredClone(event);
    other.data.attributes.type = "payment.failed";
    expect(parsePaidEvent(other)).toBeNull();
    expect(parsePaidEvent({ nope: true })).toBeNull();
    expect(parsePaidEvent(null)).toBeNull();
  });
});
