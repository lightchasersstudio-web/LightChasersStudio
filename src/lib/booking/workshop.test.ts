import { describe, expect, it } from "vitest";

import { workshopRefundCents } from "./workshop";

describe("workshopRefundCents", () => {
  it("refunds half the price when paid in full (or more)", () => {
    expect(workshopRefundCents(100_000, 100_000)).toBe(50_000);
    expect(workshopRefundCents(100_000, 120_000)).toBe(50_000);
  });

  it("refunds nothing when only half (or less) was paid", () => {
    expect(workshopRefundCents(100_000, 50_000)).toBe(0);
    expect(workshopRefundCents(100_000, 0)).toBe(0);
  });

  it("refunds nothing on a free workshop", () => {
    expect(workshopRefundCents(0, 0)).toBe(0);
  });
});
