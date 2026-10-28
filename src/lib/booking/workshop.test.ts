import { describe, expect, it } from "vitest";

import { workshopOpening, workshopRefundCents } from "./workshop";

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

describe("workshopOpening", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  const at = "2026-11-14T05:00:00Z";

  it("is closed with no date, or once it has started", () => {
    expect(workshopOpening({ workshop_starts_at: null, workshop_seats: null }, 0, now)).toEqual({
      open: false,
      reason: "no_date",
    });
    expect(
      workshopOpening({ workshop_starts_at: "2026-10-31T00:00:00Z", workshop_seats: null }, 0, now),
    ).toEqual({ open: false, reason: "started" });
  });

  it("counts the seats left, if there's a limit", () => {
    expect(workshopOpening({ workshop_starts_at: at, workshop_seats: null }, 40, now)).toEqual({
      open: true,
      seatsLeft: null,
    });
    expect(workshopOpening({ workshop_starts_at: at, workshop_seats: 15 }, 12, now)).toEqual({
      open: true,
      seatsLeft: 3,
    });
    expect(workshopOpening({ workshop_starts_at: at, workshop_seats: 15 }, 15, now)).toEqual({
      open: false,
      reason: "full",
    });
  });
});
