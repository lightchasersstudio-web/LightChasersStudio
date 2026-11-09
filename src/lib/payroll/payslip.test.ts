import { describe, expect, it } from "vitest";

import { DEFAULT_RATES } from "@/lib/payroll/contributions";
import type { DayStatus } from "@/lib/payroll/cutoff";
import { computePayslip, payrollTotals, type PayslipInput } from "@/lib/payroll/payslip";

const all = { sss: true, philhealth: true, pagibig: true };
const days = (spec: Partial<Record<DayStatus, number>>, minutes = 480) =>
  (Object.entries(spec) as [DayStatus, number][]).flatMap(([status, n]) =>
    Array.from({ length: n }, () => ({ status, minutes: status === "present" ? minutes : 0 })),
  );

const monthly: PayslipInput = {
  employee: {
    id: "e1",
    name: "Ana Cruz",
    position: "Photographer",
    salaryType: "monthly",
    salaryRate: 20000,
  },
  benefits: all,
  days: days({ present: 12, absent: 1 }),
  rates: DEFAULT_RATES,
  half: 1,
};

describe("computePayslip", () => {
  it("monthly: half the salary, a day's pay off per absence, half of each contribution", () => {
    const p = computePayslip(monthly);
    expect(p).toMatchObject({
      daily_rate: 769.23,
      monthly_salary: 20000,
      days_present: 12,
      days_absent: 1,
      minutes_worked: 5760,
      basic_pay: 10000,
      absence_deduction: 769.23,
      sss_deduction: 500,
      philhealth_deduction: 250,
      pagibig_deduction: 100,
      gross_pay: 10000,
      total_deductions: 1619.23,
      net_pay: 8380.77,
    });
  });

  it("monthly: leave and holidays are unpaid too", () => {
    const p = computePayslip({ ...monthly, days: days({ present: 10, leave: 2, holiday: 1 }) });
    expect(p.absence_deduction).toBe(2307.69); // 3 × 769.23
  });

  it("monthly: the absence deduction never goes past the basic pay", () => {
    const p = computePayslip({ ...monthly, days: days({ absent: 15 }) });
    expect(p.absence_deduction).toBe(10000);
    expect(p.net_pay).toBe(-850); // contributions still due
  });

  it("daily: paid for days present, contributions from daily × working days", () => {
    const p = computePayslip({
      ...monthly,
      employee: { ...monthly.employee, salaryType: "daily", salaryRate: 650 },
      days: days({ present: 11, absent: 1, holiday: 1 }),
      half: 2,
    });
    expect(p).toMatchObject({
      daily_rate: 650,
      monthly_salary: 16900,
      basic_pay: 7150,
      absence_deduction: 0,
      sss_deduction: 425, // MSC ₱17,000
      philhealth_deduction: 211.25,
      pagibig_deduction: 100,
      total_deductions: 736.25,
      net_pay: 6413.75,
    });
  });

  it("switched-off benefits are null (not enrolled) and cost nothing", () => {
    const p = computePayslip({
      ...monthly,
      benefits: { sss: false, philhealth: true, pagibig: false },
    });
    expect(p.sss_deduction).toBeNull();
    expect(p.pagibig_deduction).toBeNull();
    expect(p.total_deductions).toBe(1019.23);
  });

  it("the two halves of a month add up for odd centavos", () => {
    const odd = { ...monthly, employee: { ...monthly.employee, salaryRate: 16913.01 } };
    const a = computePayslip({ ...odd, days: [] });
    const b = computePayslip({ ...odd, days: [], half: 2 });
    expect(Math.round((a.basic_pay + b.basic_pay) * 100)).toBe(1691301);
    expect(Math.round(((a.philhealth_deduction ?? 0) + (b.philhealth_deduction ?? 0)) * 100)).toBe(
      42283,
    );
  });
});

describe("payrollTotals", () => {
  it("adds up every column, not-enrolled as ₱0", () => {
    const a = computePayslip(monthly);
    const b = computePayslip({ ...monthly, benefits: { ...all, sss: false } });
    expect(payrollTotals([a, b])).toEqual({
      basic_pay: 20000,
      absence_deduction: 1538.46,
      sss: 500,
      philhealth: 500,
      pagibig: 200,
      gross_pay: 20000,
      total_deductions: 2738.46,
      net_pay: 17261.54,
    });
  });
});
