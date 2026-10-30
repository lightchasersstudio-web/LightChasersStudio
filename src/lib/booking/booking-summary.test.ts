import { describe, expect, it } from "vitest";

import { bookingSummaryText, summaryPeople, type BookingSummary } from "./booking-summary";

const booking: BookingSummary = {
  reference: "BK-2026-ABC123",
  serviceName: "Family Portrait Session",
  addOns: [],
  startAt: "2026-11-03T05:00:00.000Z", // 1:00 PM in Manila
  endAt: "2026-11-03T06:00:00.000Z",
  location: "Studio",
  priceCents: 350000,
  vatCents: 0,
  paidCents: 105000,
  contactName: "Ana Cruz",
  studioName: "Light Chasers Studio",
  studioPhone: "0917 123 4567",
  studioEmail: null,
};

describe("bookingSummaryText", () => {
  it("lists the booking with Manila times and the balance", () => {
    const text = bookingSummaryText(booking);
    expect(text).toContain("BK-2026-ABC123");
    expect(text).toContain("Family Portrait Session");
    expect(text).toContain("Tue, 3 Nov 2026, 1:00 PM – 2:00 PM");
    expect(text).toContain("Total: ₱3,500");
    expect(text).toContain("Paid: ₱1,050");
    expect(text).toContain("Balance: ₱2,450");
    expect(text).toContain("0917 123 4567");
    expect(text).not.toContain("null");
  });

  it("shows only the start time when the booking has no end time", () => {
    const text = bookingSummaryText({ ...booking, endAt: null });
    expect(text).toContain("When: Tue, 3 Nov 2026, 1:00 PM\n");
  });

  it("leaves out an empty location and says when it's fully paid", () => {
    const text = bookingSummaryText({ ...booking, location: null, paidCents: 350000 });
    expect(text).not.toMatch(/Location/);
    expect(text).toContain("Fully paid");
  });
});

describe("summaryPeople", () => {
  it("orders people by position and labels their category", () => {
    expect(
      summaryPeople([
        { position: 2, full_name: "Ben", category: "student", price_cents: 400000 },
        { position: 1, full_name: "Ana", category: "early_bird", price_cents: 400000 },
      ]),
    ).toEqual([
      { name: "Ana", category: "Early bird", priceCents: 400000 },
      { name: "Ben", category: "Student", priceCents: 400000 },
    ]);
    expect(summaryPeople([])).toBeUndefined();
  });
});
