import { describe, expect, it } from "vitest";

import {
  attendeesCents,
  earlyBirdOpening,
  formatEarlyBirdUntil,
  formatWorkshopWhen,
  workshopOpening,
  workshopRefundCents,
} from "./workshop";

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

describe("formatWorkshopWhen", () => {
  it("shows the Manila date and times", () => {
    expect(formatWorkshopWhen("2026-10-29T00:00:00Z", "2026-10-29T04:00:00Z")).toEqual({
      date: "Thursday, 29 October 2026",
      time: "8:00 AM – 12:00 PM",
    });
    expect(formatWorkshopWhen("2026-11-14T05:00:00Z", "2026-11-14T09:30:00Z").time).toBe(
      "1:00 PM – 5:30 PM",
    );
  });
});

describe("workshop categories", () => {
  const prices = { regular: 500_000, early_bird: 400_000, student: 400_000 };

  it("adds up each person's category price", () => {
    expect(
      attendeesCents(
        [{ category: "regular" }, { category: "student" }, { category: "early_bird" }],
        prices,
      ),
    ).toBe(1_300_000);
  });

  it("opens early bird until its last day (Manila) and while places are left", () => {
    const w = {
      workshop_early_bird_price_cents: 400_000,
      workshop_early_bird_until: "2027-01-31",
      workshop_early_bird_seats: 25,
    };
    // 31 Jan 2027, 11 PM in Manila: still open.
    expect(earlyBirdOpening(w, 24, new Date("2027-01-31T15:00:00Z"))).toEqual({
      open: true,
      left: 1,
    });
    // 1 Feb in Manila (still 31 Jan in UTC): closed.
    expect(earlyBirdOpening(w, 0, new Date("2027-01-31T17:00:00Z")).open).toBe(false);
    expect(earlyBirdOpening(w, 25, new Date("2026-11-01T00:00:00Z"))).toEqual({
      open: false,
      left: 0,
    });
    expect(earlyBirdOpening({ ...w, workshop_early_bird_price_cents: null }, 0).open).toBe(false);
  });

  it("formats the last day", () => {
    expect(formatEarlyBirdUntil("2027-01-31")).toBe("31 January 2027");
  });
});
