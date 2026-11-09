import { formatMinutes } from "@/lib/payroll/cutoff";
import { formatAmountExact } from "@/lib/payroll/money";
import type { Payslip } from "@/lib/payroll/payslip";

// The wording of a payslip's lines, shared by the payslip dialog and the PDF.

export type PayslipLine = { label: string; hint?: string; value: string; muted?: boolean };

const minus = (v: number) => (v ? `−${formatAmountExact(v)}` : "₱0.00");

export function basicPayLine(p: Payslip): PayslipLine {
  return {
    label: "Basic pay",
    hint:
      p.salary_type === "monthly"
        ? `Half of ${formatAmountExact(p.monthly_salary)} monthly`
        : `${p.days_present} ${p.days_present === 1 ? "day" : "days"} × ${formatAmountExact(p.daily_rate)}`,
    value: formatAmountExact(p.basic_pay),
  };
}

/** Time past a shift; null when there was none. */
export function overtimeLine(p: Payslip): PayslipLine | null {
  if (!p.overtime_minutes) return null;
  const time = formatMinutes(p.overtime_minutes);
  return p.overtime_rate === null || p.overtime_pay === 0
    ? { label: "Overtime", hint: `${time} · overtime isn't paid`, value: "₱0.00", muted: true }
    : {
        label: "Overtime",
        hint: `${time} × ${formatAmountExact(p.overtime_rate)} an hour`,
        value: formatAmountExact(p.overtime_pay),
      };
}

/** Absent / leave / holiday days (monthly staff only; daily staff aren't paid for them). */
export function absencesLine(p: Payslip): PayslipLine | null {
  if (p.salary_type !== "monthly") return null;
  const days = p.days_absent + p.days_leave + p.days_holiday;
  return {
    label: "Absences",
    hint: `${days} unpaid ${days === 1 ? "day" : "days"} × ${formatAmountExact(p.daily_rate)}`,
    value: minus(p.absence_deduction),
  };
}

/** Time short of a shift on days present; null when there was none. */
export function undertimeLine(p: Payslip): PayslipLine | null {
  if (!p.undertime_minutes) return null;
  return {
    label: "Undertime",
    hint: `${formatMinutes(p.undertime_minutes)} short × ${formatAmountExact(p.hourly_rate)} an hour`,
    value: minus(p.undertime_deduction),
  };
}

export const contributionLine = (label: string, v: number | null): PayslipLine =>
  v === null ? { label, value: "Not enrolled", muted: true } : { label, value: minus(v) };

export const totalDeductionsLine = (p: Payslip): PayslipLine => ({
  label: "Total deductions",
  value: minus(p.total_deductions),
});
