import { describe, expect, it } from "vitest";

import { DEFAULT_RATES } from "@/lib/payroll/contributions";
import type { DayStatus } from "@/lib/payroll/cutoff";
import { computePayslip, payrollTotals, type PayslipInput } from "@/lib/payroll/payslip";

const all = { sss: true, philhealth: true, pagibig: true };
const H = 60;
const days = (...spec: [DayStatus, number, number?][]) =>
  spec.flatMap(([status, n, minutes = 8 * H]) =>
    Array.from({ length: n }, () => ({
      status,
      minutes: ["present", "am", "pm"].includes(status) ? minutes : 0,
    })),
  );

// The owner's example: ₱30,000 a month ÷ 30 days = ₱1,000 a day ÷ 8 hours = ₱125 an hour.
const monthly: PayslipInput = {
  employee: {
    id: "e1",
    name: "Ana Cruz",
    position: "Photographer",
    salaryType: "monthly",
    salaryRate: 30000,
    overtimeRate: 200,
  },
  benefits: all,
  days: days(["present", 12]),
  rates: DEFAULT_RATES,
  half: 1,
};

describe("computePayslip (by the hour)", () => {
  it("a full cut-off: half the salary, nothing off but contributions", () => {
    const p = computePayslip(monthly);
    expect(p).toMatchObject({
      daily_rate: 1000,
      hourly_rate: 125,
      basic_pay: 15000,
      undertime_minutes: 0,
      undertime_deduction: 0,
      overtime_pay: 0,
      sss_deduction: 750, // MSC ₱30,000 × 5% ÷ 2
      philhealth_deduction: 375,
      pagibig_deduction: 100,
      net_pay: 13775,
    });
  });

  it("8 AM–12 PM is half a day: ₱500 off the ₱1,000", () => {
    const p = computePayslip({ ...monthly, days: days(["present", 11], ["present", 1, 4 * H]) });
    expect(p.undertime_minutes).toBe(240);
    expect(p.undertime_deduction).toBe(500);
    expect(p.net_pay).toBe(13275);
  });

  it("absences take a full day, overtime is paid at the employee's rate", () => {
    const p = computePayslip({
      ...monthly,
      days: days(["present", 11], ["present", 1, 4 * H], ["present", 1, 10 * H], ["absent", 1]),
    });
    expect(p).toMatchObject({
      regular_minutes: 11 * 480 + 240 + 480,
      undertime_minutes: 240,
      overtime_minutes: 120,
      basic_pay: 15000,
      overtime_pay: 400, // 2 h × ₱200
      gross_pay: 15400,
      absence_deduction: 1000,
      undertime_deduction: 500,
      total_deductions: 2725,
      net_pay: 12675,
    });
  });

  it("no overtime rate = overtime isn't paid", () => {
    const p = computePayslip({
      ...monthly,
      employee: { ...monthly.employee, overtimeRate: null },
      days: days(["present", 1, 12 * H]),
    });
    expect(p.overtime_minutes).toBe(240);
    expect(p.overtime_pay).toBe(0);
  });

  it("leave and holidays are unpaid; time off never goes past the basic pay", () => {
    expect(
      computePayslip({ ...monthly, days: days(["leave", 2], ["holiday", 1]) }).absence_deduction,
    ).toBe(3000);
    const p = computePayslip({ ...monthly, days: days(["absent", 15], ["present", 1, 60]) });
    expect(p.absence_deduction).toBe(15000);
    expect(p.undertime_deduction).toBe(0);
    expect(p.net_pay).toBe(-1225); // contributions still due
  });

  it("daily: daily rate per present day, minus undertime by the hour", () => {
    const p = computePayslip({
      ...monthly,
      employee: { ...monthly.employee, salaryType: "daily", salaryRate: 650, overtimeRate: null },
      days: days(["present", 10], ["present", 1, 4 * H], ["absent", 1]),
      half: 2,
    });
    expect(p).toMatchObject({
      daily_rate: 650,
      hourly_rate: 81.25,
      monthly_salary: 19500, // × 30 days, for contributions
      basic_pay: 7150, // 11 days
      undertime_deduction: 325, // 4 h × ₱81.25
      absence_deduction: 0,
      sss_deduction: 487.5,
      philhealth_deduction: 243.75,
      pagibig_deduction: 100,
      total_deductions: 1156.25,
      net_pay: 5993.75,
    });
  });

  it("AM/PM shifts are full days; rest days are neither paid nor absences", () => {
    const daily = {
      ...monthly,
      employee: { ...monthly.employee, salaryType: "daily" as const, salaryRate: 650 },
    };
    // An AM shift cut short still pays the full day.
    const p = computePayslip({
      ...daily,
      days: days(["am", 1], ["pm", 1, 5 * H], ["rest_day", 2]),
    });
    expect(p).toMatchObject({
      days_present: 2,
      days_absent: 0,
      basic_pay: 1300,
      undertime_deduction: 0,
      overtime_pay: 0,
      absence_deduction: 0,
    });
    // Monthly staff: rest days take nothing off.
    const m = computePayslip({ ...monthly, days: days(["am", 10], ["rest_day", 2]) });
    expect(m.absence_deduction).toBe(0);
    expect(m.basic_pay).toBe(15000);
  });

  it("daily staff are paid each day's saved rate, not today's salary", () => {
    const p = computePayslip({
      ...monthly,
      employee: { ...monthly.employee, salaryType: "daily", salaryRate: 800, overtimeRate: null },
      days: [
        { status: "am", minutes: 480, dailyRate: 650 }, // before a raise
        { status: "pm", minutes: 480, dailyRate: 1000 }, // special event day
        { status: "present", minutes: 480 }, // no saved rate: today's ₱800
      ],
    });
    expect(p.basic_pay).toBe(2450);
  });

  it("undertime is worked out to the minute", () => {
    // 15 minutes short of ₱125/hour = ₱31.25
    const p = computePayslip({ ...monthly, days: days(["present", 1, 8 * H - 15]) });
    expect(p.undertime_deduction).toBe(31.25);
  });

  it("switched-off benefits are null (not enrolled) and cost nothing", () => {
    const p = computePayslip({
      ...monthly,
      benefits: { sss: false, philhealth: true, pagibig: false },
    });
    expect(p.sss_deduction).toBeNull();
    expect(p.pagibig_deduction).toBeNull();
    expect(p.total_deductions).toBe(375);
  });

  it("the two halves of a month add up for odd centavos", () => {
    const odd = { ...monthly, employee: { ...monthly.employee, salaryRate: 16913.01 } };
    const a = computePayslip({ ...odd, days: [] });
    const b = computePayslip({ ...odd, days: [], half: 2 });
    expect(Math.round((a.basic_pay + b.basic_pay) * 100)).toBe(1691301);
  });
});

describe("payrollTotals", () => {
  it("adds up every column, not-enrolled as ₱0", () => {
    const a = computePayslip({ ...monthly, days: days(["present", 1, 10 * H]) });
    const b = computePayslip({
      ...monthly,
      benefits: { ...all, sss: false },
      days: days(["present", 1, 4 * H]),
    });
    expect(payrollTotals([a, b])).toEqual({
      basic_pay: 30000,
      overtime_pay: 400,
      absence_deduction: 0,
      undertime_deduction: 500,
      sss: 750,
      philhealth: 750,
      pagibig: 200,
      gross_pay: 30400,
      total_deductions: 2200,
      net_pay: 28200,
    });
  });
});
