import { describe, expect, it } from "vitest";

import { blackoutSchema, datesInRange, weeklyHoursSchema } from "./availability";
import { updatePortfolioImageSchema } from "./portfolio";
import { bookingRulesSchema } from "./settings";
import { serviceSchema, slugify, workshopFormValues, type ServiceFormInput } from "./services";

const service: ServiceFormInput = {
  name: "Prenup Session",
  slug: "prenup-session",
  category: "wedding",
  summary: "",
  description: "",
  hasSetLength: false,
  lengthHours: "",
  price: "15,000",
  depositMode: "default",
  deposit: "",
  inclusions: "  2 locations \n\n 50 edited photos ",
  coverImagePath: null,
  isActive: true,
  workshopDate: "",
  workshopStart: "",
  workshopEnd: "",
  workshopSeats: "",
};

describe("serviceSchema", () => {
  it("maps form strings to a DB row", () => {
    const row = serviceSchema.parse(service);
    expect(row).toMatchObject({
      price_cents: 1_500_000,
      duration_minutes: null,
      deposit_cents: null,
      summary: null,
      inclusions: ["2 locations", "50 edited photos"],
    });
  });

  it("accepts a fixed deposit up to the price", () => {
    const row = serviceSchema.parse({ ...service, depositMode: "fixed", deposit: "5000" });
    expect(row.deposit_cents).toBe(500_000);
  });

  it("rejects a deposit above the price or a bad amount", () => {
    for (const deposit of ["20000", "abc"]) {
      const r = serviceSchema.safeParse({ ...service, depositMode: "fixed", deposit });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.path).toEqual(["deposit"]);
    }
  });

  it("stores a set length in minutes, only when switched on", () => {
    const timed = { ...service, hasSetLength: true, lengthHours: "4.5" };
    expect(serviceSchema.parse(timed).duration_minutes).toBe(270);
    expect(serviceSchema.parse({ ...service, lengthHours: "4" }).duration_minutes).toBeNull();
  });

  it("rejects bad slugs and bad lengths", () => {
    expect(serviceSchema.safeParse({ ...service, slug: "Bad Slug!" }).success).toBe(false);
    for (const lengthHours of ["", "0.25", "25", "4.1", "abc"]) {
      const r = serviceSchema.safeParse({ ...service, hasSetLength: true, lengthHours });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.path).toEqual(["lengthHours"]);
    }
  });
});

describe("serviceSchema: workshop schedule", () => {
  const workshop = {
    ...service,
    category: "workshop" as const,
    workshopDate: "2026-11-14",
    workshopStart: "13:00",
    workshopEnd: "17:30",
    workshopSeats: "15",
  };

  it("stores Manila times as timestamps, with the seats", () => {
    expect(serviceSchema.parse(workshop)).toMatchObject({
      workshop_starts_at: "2026-11-14T05:00:00.000Z",
      workshop_ends_at: "2026-11-14T09:30:00.000Z",
      workshop_seats: 15,
    });
  });

  it("round-trips back to the form", () => {
    const row = serviceSchema.parse(workshop);
    expect(workshopFormValues(row)).toEqual({
      workshopDate: "2026-11-14",
      workshopStart: "13:00",
      workshopEnd: "17:30",
      workshopSeats: "15",
    });
  });

  it("allows no date yet and no seat limit", () => {
    const row = serviceSchema.parse({
      ...workshop,
      workshopDate: "",
      workshopStart: "",
      workshopEnd: "",
      workshopSeats: "",
    });
    expect(row).toMatchObject({
      workshop_starts_at: null,
      workshop_ends_at: null,
      workshop_seats: null,
    });
  });

  it("rejects a half-filled time, an end before the start, or bad seats", () => {
    const cases: [Partial<ServiceFormInput>, string][] = [
      [{ workshopStart: "" }, "workshopStart"],
      [{ workshopDate: "" }, "workshopDate"],
      [{ workshopEnd: "12:00" }, "workshopEnd"],
      [{ workshopSeats: "0" }, "workshopSeats"],
      [{ workshopSeats: "ten" }, "workshopSeats"],
    ];
    for (const [change, path] of cases) {
      const r = serviceSchema.safeParse({ ...workshop, ...change });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.path).toEqual([path]);
    }
  });

  it("ignores the schedule on other packages", () => {
    const row = serviceSchema.parse({ ...workshop, category: "portrait" });
    expect(row.workshop_starts_at).toBeNull();
    expect(row.workshop_seats).toBeNull();
  });
});

describe("slugify", () => {
  it("makes URL-safe names", () => {
    expect(slugify("  Wedding — Gold Package! ")).toBe("wedding-gold-package");
    expect(slugify("Café Portraits")).toBe("cafe-portraits");
  });
});

const closed = { open: false, windows: [] };
const week = (monday: { open: boolean; windows: { start: string; end: string }[] }) => ({
  days: [closed, monday, closed, closed, closed, closed, closed],
});

describe("weeklyHoursSchema", () => {
  it("flattens open days into rules", () => {
    const rules = weeklyHoursSchema.parse(
      week({
        open: true,
        windows: [
          { start: "09:00", end: "12:00" },
          { start: "13:00", end: "18:00" },
        ],
      }),
    );
    expect(rules).toEqual([
      { day_of_week: 1, start_time: "09:00", end_time: "12:00" },
      { day_of_week: 1, start_time: "13:00", end_time: "18:00" },
    ]);
  });

  it("rejects overlapping, backwards or missing hours", () => {
    const bad = [
      {
        open: true,
        windows: [
          { start: "09:00", end: "13:00" },
          { start: "12:00", end: "18:00" },
        ],
      },
      { open: true, windows: [{ start: "18:00", end: "09:00" }] },
      { open: true, windows: [] },
    ];
    for (const monday of bad) expect(weeklyHoursSchema.safeParse(week(monday)).success).toBe(false);
  });

  it("ignores windows on closed days", () => {
    expect(
      weeklyHoursSchema.parse(week({ open: false, windows: [{ start: "09:00", end: "10:00" }] })),
    ).toEqual([]);
  });
});

describe("blackoutSchema", () => {
  const base = { reason: "Holiday", today: "2026-10-14" };

  it("expands a range into dates", () => {
    const r = blackoutSchema.parse({ ...base, from: "2026-12-30", to: "2027-01-02" });
    expect(r.dates).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });

  it("rejects past dates, reversed and oversized ranges", () => {
    expect(blackoutSchema.safeParse({ ...base, from: "2026-10-13", to: "" }).success).toBe(false);
    expect(
      blackoutSchema.safeParse({ ...base, from: "2026-11-02", to: "2026-11-01" }).success,
    ).toBe(false);
    expect(
      blackoutSchema.safeParse({ ...base, from: "2026-11-01", to: "2027-01-15" }).success,
    ).toBe(false);
  });

  it("datesInRange is inclusive", () => {
    expect(datesInRange("2026-03-01", "2026-03-01")).toEqual(["2026-03-01"]);
  });
});

describe("updatePortfolioImageSchema", () => {
  const base = {
    id: "8a6e0804-2bd0-4672-b79d-d97027f9071b",
    category: "studio",
    altText: "Couple in the studio",
    caption: "",
    isFeatured: false,
  };

  it("links a photo to a package", () => {
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    expect(updatePortfolioImageSchema.parse({ ...base, serviceId: id }).serviceId).toBe(id);
  });

  it("treats an empty package choice as no link", () => {
    expect(updatePortfolioImageSchema.parse({ ...base, serviceId: "" }).serviceId).toBeNull();
  });
});

describe("bookingRulesSchema", () => {
  const rules = {
    minNoticeHours: "48",
    maxAdvanceDays: "180",
    slotIntervalMinutes: "30",
    bufferMinutes: "30",
    defaultDepositPercent: "30",
    vatPercent: "12",
    holdMinutes: "20",
    maxConcurrentBookings: "3",
  } as const;

  it("saves how many shoots can run at the same time", () => {
    expect(bookingRulesSchema.parse(rules).max_concurrent_bookings).toBe(3);
  });

  it("keeps it between 1 and 10", () => {
    expect(bookingRulesSchema.safeParse({ ...rules, maxConcurrentBookings: "0" }).success).toBe(
      false,
    );
    expect(bookingRulesSchema.safeParse({ ...rules, maxConcurrentBookings: "11" }).success).toBe(
      false,
    );
  });
});
