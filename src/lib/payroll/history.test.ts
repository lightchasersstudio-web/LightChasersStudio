import { describe, expect, it } from "vitest";

import { payrollDays, payrollYears } from "./history";

const slip = (net: number, gross = net, deductions = gross - net) => ({
  net_pay: String(net),
  gross_pay: String(gross),
  total_deductions: String(deductions),
});

describe("payrollYears", () => {
  const years = payrollYears([
    { start: "2026-11-16", payslips: [slip(1000.5), slip(500)] },
    { start: "2026-11-01", payslips: [slip(5882.5, 6920, 1037.5)] },
    { start: "2026-10-16", payslips: [slip(200)] },
    { start: "2025-12-16", payslips: [slip(100)] },
    { start: "2026-11-05", payslips: [slip(999)] }, // not a cut-off: ignored
  ]);

  it("adds net pay up by year, newest first", () => {
    expect(years.map((y) => [y.year, y.netCents])).toEqual([
      ["2026", 758_300],
      ["2025", 10_000],
    ]);
  });

  it("adds each month's cut-offs, in order", () => {
    const nov = years[0]!.months.find((m) => m.month === "2026-11")!;
    expect(nov.netCents).toBe(738_300);
    expect(nov.grossCents).toBe(842_050);
    expect(nov.deductionsCents).toBe(103_750);
    expect(nov.cutoffs.map((c) => [c.label, c.people])).toEqual([
      ["Nov 1–15, 2026", 1],
      ["Nov 16–30, 2026", 2],
    ]);
    expect(years[0]!.months.map((m) => m.month)).toEqual(["2026-10", "2026-11"]);
  });
});

describe("payrollDays", () => {
  it("prices each day from the time record", () => {
    const days = payrollDays(
      [
        {
          date: "2026-11-02",
          name: "Cora",
          status: "am_pm",
          minutes: 750,
          dailyRate: 650,
          overtimeRate: null,
        },
        {
          date: "2026-11-02",
          name: "Ana",
          status: "present",
          minutes: 480,
          dailyRate: 500,
          overtimeRate: null,
        },
        {
          date: "2026-11-02",
          name: "Ben",
          status: "rest_day",
          minutes: 0,
          dailyRate: 500,
          overtimeRate: null,
        },
        // 2 hours over at ₱100 an hour.
        {
          date: "2026-11-01",
          name: "Ana",
          status: "present",
          minutes: 600,
          dailyRate: 500,
          overtimeRate: 100,
        },
      ],
      480,
    );
    expect(days.map(({ date, people, payCents }) => ({ date, people, payCents }))).toEqual([
      { date: "2026-11-01", people: 1, payCents: 70_000 },
      { date: "2026-11-02", people: 2, payCents: 115_000 },
    ]);
    // Each person on the day, by name, with what they earned.
    expect(days[1]!.staff).toEqual([
      { name: "Ana", status: "present", payCents: 50_000 },
      { name: "Ben", status: "rest_day", payCents: 0 },
      { name: "Cora", status: "am_pm", payCents: 65_000 },
    ]);
  });
});
