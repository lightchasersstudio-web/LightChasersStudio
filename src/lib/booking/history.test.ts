import { describe, expect, it } from "vitest";

import { describeHistoryEntry } from "./history";

describe("describeHistoryEntry", () => {
  it("names simple actions", () => {
    expect(describeHistoryEntry("booking.confirmed", {})).toBe("Confirmed the booking");
    expect(describeHistoryEntry("payment.record", { provider: "gcash", amount_cents: 50000 })).toBe(
      "Recorded a GCash payment of ₱500",
    );
  });

  it("summarises what an edit changed", () => {
    const text = describeHistoryEntry("booking.update", {
      before: {
        start_at: "2026-11-03T05:00:00.000Z",
        price_cents: 350000,
        add_ons: [],
        service_id: "a",
      },
      after: {
        start_at: "2026-11-04T05:00:00.000Z",
        price_cents: 400000,
        add_ons: [{ name: "Prints", price_cents: 50000 }],
        service_id: "a",
      },
      emailed_client: true,
    });
    expect(text).toContain("moved to Wed, 4 Nov 2026, 1:00 PM");
    expect(text).toContain("total ₱3,500 → ₱4,000");
    expect(text).toContain("add-ons changed");
    expect(text).toContain("client emailed");
  });

  it("falls back to the raw action name", () => {
    expect(describeHistoryEntry("booking.something_new", {})).toBe("booking.something_new");
  });
});
