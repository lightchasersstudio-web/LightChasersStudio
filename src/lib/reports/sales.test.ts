import { describe, expect, it } from "vitest";

import { buildSalesMonths, reportEnd, reportStart } from "./sales";

// 19 Oct 2026, 10:00 in Manila.
const now = new Date("2026-10-19T02:00:00.000Z");

describe("buildSalesMonths", () => {
  it("lists the months up to this one, oldest first", () => {
    const months = buildSalesMonths([], [], 3, now);
    expect(months.map((m) => m.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(months[2]).toMatchObject({ label: "Oct", longLabel: "October 2026", bookings: 0 });
  });

  it("counts each booking in its shoot month, in Manila time", () => {
    const months = buildSalesMonths(
      [
        // 1 Oct 01:00 in Manila is still 30 Sep in UTC.
        { startAt: "2026-09-30T17:00:00.000Z", priceCents: 500_000, category: "portrait" },
        { startAt: "2026-10-25T02:00:00.000Z", priceCents: 1_000_000, category: "wedding" },
        { startAt: "2026-09-10T02:00:00.000Z", priceCents: 200_000, category: null },
        { startAt: "2025-01-10T02:00:00.000Z", priceCents: 999_999, category: "event" },
      ],
      [],
      2,
      now,
    );
    const [sep, oct] = months;
    expect(sep).toMatchObject({ bookings: 1, salesCents: 200_000, byCategory: {} });
    expect(oct).toMatchObject({
      bookings: 2,
      salesCents: 1_500_000,
      byCategory: {
        portrait: { bookings: 1, salesCents: 500_000 },
        wedding: { bookings: 1, salesCents: 1_000_000 },
      },
    });
  });

  it("counts workshop sign-ups and their people by price category", () => {
    const [oct] = buildSalesMonths(
      [
        {
          startAt: "2026-10-25T02:00:00.000Z",
          priceCents: 896_000,
          category: "workshop",
          attendees: [
            { category: "early_bird", priceCents: 400_000 },
            { category: "student", priceCents: 400_000 },
          ],
        },
        {
          startAt: "2026-10-25T02:00:00.000Z",
          priceCents: 560_000,
          category: "workshop",
          attendees: [{ category: "early_bird", priceCents: 400_000 }],
        },
      ],
      [],
      1,
      now,
    );
    expect(oct!.workshop).toEqual({
      signUps: 2,
      people: {
        early_bird: { people: 2, cents: 800_000 },
        student: { people: 1, cents: 400_000 },
      },
    });
  });

  it("splits money received by how it was paid", () => {
    const [oct] = buildSalesMonths(
      [],
      [
        { paidAt: "2026-10-02T02:00:00.000Z", amountCents: 300_000, provider: "paymongo" },
        { paidAt: "2026-10-03T02:00:00.000Z", amountCents: 100_000, provider: "gcash" },
        { paidAt: "2026-10-04T02:00:00.000Z", amountCents: 50_000, provider: "cash" },
        { paidAt: "2026-10-05T02:00:00.000Z", amountCents: 25_000, provider: "gcash" },
      ],
      1,
      now,
    );
    expect(oct!.byMethod).toEqual({ online: 300_000, gcash: 125_000, cash: 50_000 });
  });
});

describe("report range", () => {
  it("runs from the first of the oldest month to the first of next month", () => {
    expect(reportStart(3, now).toISOString()).toBe("2026-07-31T16:00:00.000Z");
    expect(reportEnd(now).toISOString()).toBe("2026-10-31T16:00:00.000Z");
  });
});
