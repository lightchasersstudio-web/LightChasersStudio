import { describe, expect, it } from "vitest";

import {
  buildDailyPayroll,
  endsNextDay,
  formatClock,
  parseDailyPayrollFilter,
  parseReportDate,
  type DailyPayrollRecord,
} from "@/lib/payroll/daily-report";

const rec = (r: Partial<DailyPayrollRecord> & Pick<DailyPayrollRecord, "name">) =>
  ({
    employeeId: r.name,
    position: "Staff",
    category: null,
    status: "am",
    timeIn: null,
    timeOut: null,
    timeOutEdited: false,
    minutes: 0,
    dailyRate: 0,
    overtimeRate: null,
    ...r,
  }) satisfies DailyPayrollRecord;

// The sample day from the request: an AM shift, a PM shift past midnight and
// a rest day, one in each category. By hand: ₱650 + ₱800.50 + ₱0 = ₱1,450.50.
const sample = [
  rec({
    name: "Bea (Studio, AM)",
    category: "studio",
    status: "am",
    timeIn: "08:00",
    timeOut: "16:00",
    minutes: 480,
    dailyRate: 650,
  }),
  rec({
    name: "Carlo (Events, PM past midnight)",
    category: "events",
    status: "pm",
    timeIn: "18:00",
    timeOut: "02:00",
    minutes: 480,
    dailyRate: 800.5,
  }),
  rec({ name: "Dina (Photobooth, rest day)", category: "photobooth", status: "rest_day" }),
];

describe("buildDailyPayroll", () => {
  const day = (filter: Parameters<typeof buildDailyPayroll>[0]["filter"], records = sample) =>
    buildDailyPayroll({ date: "2026-11-10", filter, records, shiftMinutes: 480 });

  it("adds up the sample day: AM + PM at full rate, rest day ₱0", () => {
    const r = day("all");
    expect(r.rows.map((x) => [x.name, x.pay])).toEqual([
      ["Carlo (Events, PM past midnight)", 800.5],
      ["Dina (Photobooth, rest day)", 0],
      ["Bea (Studio, AM)", 650],
    ]);
    expect(r.total).toBe(1450.5);
    expect(r.paidCount).toBe(2);
    expect(r.subtotals).toEqual([
      { value: "events", label: "Events", pay: 800.5, people: 1 },
      { value: "photobooth", label: "Photobooth", pay: 0, people: 1 },
      { value: "studio", label: "Studio", pay: 650, people: 1 },
    ]);
  });

  it("the total always equals the rows (the footer matches the card)", () => {
    const r = day("all");
    expect(Math.round(r.rows.reduce((s, x) => s + x.pay * 100, 0))).toBe(r.total * 100);
  });

  it("a category filter narrows the rows and total; subtotals still cover the day", () => {
    const r = day("events");
    expect(r.rows).toHaveLength(1);
    expect(r.total).toBe(800.5);
    expect(r.subtotals.map((s) => s.pay)).toEqual([800.5, 0, 650]);
  });

  it("staff without a category show as Uncategorized", () => {
    const r = day("all", [...sample, rec({ name: "Old hire", dailyRate: 500 })]);
    expect(r.subtotals.at(-1)).toEqual({
      value: "none",
      label: "Uncategorized",
      pay: 500,
      people: 1,
    });
    expect(day("none", [...sample, rec({ name: "Old hire", dailyRate: 500 })]).total).toBe(500);
  });

  it("present days keep their hourly rule; absences are ₱0", () => {
    const r = day("all", [
      rec({ name: "Half day", status: "present", minutes: 240, dailyRate: 800 }),
      rec({ name: "Sick", status: "absent", dailyRate: 800 }),
    ]);
    expect(r.rows.map((x) => x.pay)).toEqual([400, 0]);
    expect(r.paidCount).toBe(1);
  });

  it("nothing recorded", () => {
    const r = day("all", []);
    expect(r).toMatchObject({ hasRecords: false, rows: [], total: 0, paidCount: 0 });
  });
});

describe("helpers", () => {
  it("parses dates and filters from the URL", () => {
    expect(parseReportDate("2026-11-10")).toBe("2026-11-10");
    expect(parseReportDate("2026-02-30")).toBeNull();
    expect(parseReportDate("nope")).toBeNull();
    expect(parseDailyPayrollFilter("studio")).toBe("studio");
    expect(parseDailyPayrollFilter("weddings")).toBe("all");
  });

  it("formats clock times and spots shifts past midnight", () => {
    expect(formatClock("08:00")).toBe("8:00 AM");
    expect(formatClock("14:00")).toBe("2:00 PM");
    expect(formatClock("00:30")).toBe("12:30 AM");
    expect(endsNextDay("18:00", "02:00")).toBe(true);
    expect(endsNextDay("08:00", "16:00")).toBe(false);
  });
});
