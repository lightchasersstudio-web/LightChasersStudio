import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";

import { monthSlots, occupancyAt, type BusyRange, type SlotRules } from "./slots";

const TZ = "Asia/Manila";
// 2026-10-31 08:00 in Manila. With 48h notice the first bookable time is Mon 2 Nov, 08:00.
const NOW = new Date("2026-10-31T00:00:00Z");
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: "08:00", end: "19:00" }));
const RULES: SlotRules = {
  durationMinutes: 60,
  bufferMinutes: 30,
  slotIntervalMinutes: 30,
  minNoticeHours: 48,
  maxAdvanceDays: 180,
  capacity: 1,
};

/** A Manila wall-clock time in November 2026. */
const nov = (day: number, hour: number, minute = 0) => new TZDate(2026, 10, day, hour, minute, TZ);
const busy = (day: number, from: [number, number], to: [number, number]): BusyRange => ({
  start: new Date(nov(day, ...from).getTime()),
  end: new Date(nov(day, ...to).getTime()),
});
const hhmm = (d: Date) => {
  const t = new TZDate(d.getTime(), TZ);
  return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
};

function day(date: string, opts: Partial<Parameters<typeof monthSlots>[number]> = {}) {
  const days = monthSlots({
    month: "2026-11",
    rules: RULES,
    hours: EVERY_DAY,
    blackouts: [],
    busy: [],
    now: NOW,
    ...opts,
  });
  return days.find((d) => d.date === date)!;
}

describe("monthSlots", () => {
  it("lists every day of the month by its Manila date", () => {
    const days = monthSlots({
      month: "2026-11",
      rules: RULES,
      hours: EVERY_DAY,
      blackouts: [],
      busy: [],
      now: NOW,
    });
    expect(days).toHaveLength(30);
    expect(days[0]!.date).toBe("2026-11-01");
    expect(days[29]!.date).toBe("2026-11-30");
  });

  it("offers start times on the slot interval that finish by closing time", () => {
    const d = day("2026-11-03");
    expect(d.status).toBe("open");
    expect(d.slots.map(hhmm)).toEqual(
      Array.from({ length: 21 }, (_, i) => hhmm(nov(3, 8, i * 30))), // 08:00 … 18:00
    );
    expect(d.slots[0]!.toISOString()).toBe("2026-11-03T00:00:00.000Z"); // 08:00 Manila = 00:00 UTC
  });

  it("respects the notice period and the booking window", () => {
    expect(day("2026-11-01").status).toBe("closed"); // inside the 48h notice
    expect(day("2026-11-02").slots.map(hhmm)[0]).toBe("08:00"); // exactly 48h later is fine
    const short = { ...RULES, maxAdvanceDays: 10 }; // ends 10 Nov 08:00
    expect(day("2026-11-10", { rules: short }).slots.map(hhmm)).toEqual(["08:00"]);
    expect(day("2026-11-11", { rules: short }).status).toBe("closed");
  });

  it("closes blacked-out days and days without opening hours", () => {
    expect(day("2026-11-05", { blackouts: ["2026-11-05"] }).status).toBe("closed");
    const mondaysOnly = [{ day: 1, start: "08:00", end: "19:00" }];
    expect(day("2026-11-03", { hours: mondaysOnly }).status).toBe("closed"); // a Tuesday
    expect(day("2026-11-09", { hours: mondaysOnly }).status).toBe("open");
  });

  it("hides times that would clash with a booking, including the buffer", () => {
    // Booked 10:00-11:00, blocked until 11:30.
    const taken = [busy(3, [10, 0], [11, 30])];
    const times = day("2026-11-03", { busy: taken }).slots.map(hhmm);
    expect(times).toContain("08:30"); // 08:30-09:30 + buffer ends exactly at 10:00
    for (const t of ["09:00", "09:30", "10:00", "10:30", "11:00"]) expect(times).not.toContain(t);
    expect(times).toContain("11:30");
    // With room for two shoots at once, the same times stay open.
    const two = day("2026-11-03", { busy: taken, rules: { ...RULES, capacity: 2 } });
    expect(two.slots.map(hhmm)).toContain("10:00");
  });

  it("marks days with one or two times left as few, and fully taken days as full", () => {
    const short = [{ day: 2, start: "08:00", end: "09:30" }]; // Tuesdays: 08:00 and 08:30 only
    expect(day("2026-11-03", { hours: short }).status).toBe("few");
    const allDay = [busy(3, [7, 0], [20, 0])];
    expect(day("2026-11-03", { busy: allDay })).toMatchObject({ status: "full", slots: [] });
  });

  it("lets staff book inside the notice period", () => {
    const staff = { ...RULES, ignoreWindow: true };
    expect(day("2026-11-01", { rules: staff }).status).toBe("open");
  });

  it("never offers staff a time that has already passed", () => {
    const staff = { ...RULES, ignoreWindow: true };
    // NOW is 31 Oct 08:00 in Manila: the 08:00 slot is now, earlier days are gone.
    const october = (date: string) => day(date, { rules: staff, month: "2026-10" });
    const today = october("2026-10-31").slots;
    expect(today.map(hhmm)[0]).toBe("08:00");
    expect(today.every((t) => t.getTime() >= NOW.getTime())).toBe(true);
    expect(october("2026-10-30").slots).toHaveLength(0);
  });
});

describe("occupancyAt", () => {
  it("counts only bookings that are on at the same moment", () => {
    const backToBack = [busy(3, [10, 0], [11, 0]), busy(3, [11, 0], [12, 0])];
    expect(occupancyAt(backToBack, nov(3, 10, 30), nov(3, 12, 0))).toBe(1);
    const overlapping = [busy(3, [10, 0], [12, 0]), busy(3, [11, 0], [12, 0])];
    expect(occupancyAt(overlapping, nov(3, 10, 30), nov(3, 12, 0))).toBe(2);
    expect(occupancyAt(overlapping, nov(3, 12, 0), nov(3, 13, 0))).toBe(0);
  });
});
