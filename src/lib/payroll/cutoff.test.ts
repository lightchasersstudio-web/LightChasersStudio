import { describe, expect, it } from "vitest";

import {
  cutoffDates,
  cutoffFor,
  cutoffLabel,
  dayTotals,
  daysWorked,
  formatMinutes,
  minutesWorked,
  parseCutoff,
  shiftCutoff,
} from "@/lib/payroll/cutoff";

describe("cut-offs", () => {
  it("finds the cut-off for a date", () => {
    expect(cutoffFor("2026-11-15")).toEqual({ start: "2026-11-01", end: "2026-11-15", half: 1 });
    expect(cutoffFor("2026-11-16")).toEqual({ start: "2026-11-16", end: "2026-11-30", half: 2 });
    expect(cutoffFor("2028-02-20").end).toBe("2028-02-29"); // leap year
    expect(cutoffFor("2026-02-20").end).toBe("2026-02-28");
  });

  it("parses only real cut-off ids", () => {
    expect(parseCutoff("2026-12-16")?.end).toBe("2026-12-31");
    expect(parseCutoff("2026-12-15")).toBeNull();
    expect(parseCutoff("2026-13-01")).toBeNull();
    expect(parseCutoff(undefined)).toBeNull();
  });

  it("moves between cut-offs across months and years", () => {
    const dec2 = cutoffFor("2026-12-20");
    expect(shiftCutoff(dec2, 1).start).toBe("2027-01-01");
    expect(shiftCutoff(cutoffFor("2027-01-05"), -1).start).toBe("2026-12-16");
    expect(shiftCutoff(cutoffFor("2026-11-05"), 1).start).toBe("2026-11-16");
  });

  it("lists the dates and labels the cut-off", () => {
    const c = cutoffFor("2026-02-16");
    expect(cutoffDates(c)).toHaveLength(13);
    expect(cutoffDates(cutoffFor("2026-11-01"))).toHaveLength(15);
    expect(cutoffLabel(c)).toBe("Feb 16–28, 2026");
  });
});

describe("hours", () => {
  it("matches the database, including shifts past midnight", () => {
    expect(minutesWorked("08:00", "17:30")).toBe(570);
    expect(minutesWorked("18:00", "01:15")).toBe(435);
    expect(formatMinutes(570)).toBe("9h 30m");
    expect(formatMinutes(480)).toBe("8h");
    expect(formatMinutes(65)).toBe("1h 05m");
  });

  it("adds up a cut-off", () => {
    expect(
      dayTotals([
        { status: "present", minutes: 480 },
        { status: "present", minutes: 300 },
        { status: "absent", minutes: 0 },
        { status: "holiday", minutes: 0 },
      ]),
    ).toEqual({
      present: 2,
      am: 0,
      pm: 0,
      rest_day: 0,
      absent: 1,
      leave: 0,
      holiday: 1,
      minutes: 780,
    });
  });

  it("counts AM and PM shifts as days worked, rest days on their own", () => {
    const t = dayTotals([
      { status: "present", minutes: 480 },
      { status: "am", minutes: 480 },
      { status: "pm", minutes: 480 },
      { status: "rest_day", minutes: 0 },
    ]);
    expect(daysWorked(t)).toBe(3);
    expect(t.rest_day).toBe(1);
    expect(t.absent).toBe(0);
  });
});
