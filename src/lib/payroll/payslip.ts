import {
  cutoffShare,
  monthlyContributions,
  type Benefit,
  type ContributionRates,
} from "@/lib/payroll/contributions";
import { dayTotals, type DayStatus } from "@/lib/payroll/cutoff";
import { salaryRates, type SalaryType } from "@/lib/payroll/employees";
import { toCents, toPesos } from "@/lib/payroll/money";

export type PayslipInput = {
  employee: {
    id: string;
    name: string;
    position: string;
    salaryType: SalaryType;
    salaryRate: number;
  };
  benefits: Record<Benefit, boolean>;
  days: { status: DayStatus; minutes: number }[];
  rates: ContributionRates;
  half: 1 | 2;
};

/** A payslip row, shaped like the payslips table (pesos). */
export type Payslip = {
  employee_id: string;
  employee_name: string;
  employee_position: string;
  salary_type: SalaryType;
  salary_rate: number;
  daily_rate: number;
  monthly_salary: number;
  days_present: number;
  days_absent: number;
  days_leave: number;
  days_holiday: number;
  minutes_worked: number;
  basic_pay: number;
  absence_deduction: number;
  /** null = not enrolled */
  sss_deduction: number | null;
  philhealth_deduction: number | null;
  pagibig_deduction: number | null;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
};

/**
 * One employee's pay for a cut-off (owner decisions 2026-11-09: leave and
 * holiday days are unpaid).
 *
 * - Monthly: basic = half the monthly salary; each absent / leave / holiday
 *   day deducts a daily rate (monthly ÷ working days), never more than basic.
 * - Daily: basic = daily rate × days present; nothing else is deducted for
 *   days off, since they weren't paid.
 * - SSS / PhilHealth / Pag-IBIG: half the monthly employee share, from the
 *   monthly salary (daily × working days for daily staff); null when off.
 * - Gross = basic; total deductions = absences + contributions; net = gross − deductions.
 */
export function computePayslip({ employee, benefits, days, rates, half }: PayslipInput): Payslip {
  const { monthly, daily } = salaryRates(
    employee.salaryType,
    employee.salaryRate,
    rates.workDaysPerMonth,
  );
  const t = dayTotals(days);
  const unpaidDays = t.absent + t.leave + t.holiday;

  const basicCents =
    employee.salaryType === "monthly"
      ? toCents(cutoffShare(monthly, half))
      : toCents(daily) * t.present;
  const absenceCents =
    employee.salaryType === "monthly" ? Math.min(basicCents, toCents(daily) * unpaidDays) : 0;

  const shares = monthlyContributions(monthly, rates);
  const share = (b: Benefit) => (benefits[b] ? cutoffShare(shares[b].monthly, half) : null);
  const sss = share("sss");
  const philhealth = share("philhealth");
  const pagibig = share("pagibig");

  const totalCents =
    absenceCents + toCents(sss ?? 0) + toCents(philhealth ?? 0) + toCents(pagibig ?? 0);

  return {
    employee_id: employee.id,
    employee_name: employee.name,
    employee_position: employee.position,
    salary_type: employee.salaryType,
    salary_rate: employee.salaryRate,
    daily_rate: daily,
    monthly_salary: monthly,
    days_present: t.present,
    days_absent: t.absent,
    days_leave: t.leave,
    days_holiday: t.holiday,
    minutes_worked: t.minutes,
    basic_pay: toPesos(basicCents),
    absence_deduction: toPesos(absenceCents),
    sss_deduction: sss,
    philhealth_deduction: philhealth,
    pagibig_deduction: pagibig,
    gross_pay: toPesos(basicCents),
    total_deductions: toPesos(totalCents),
    net_pay: toPesos(basicCents - totalCents),
  };
}

export type PayrollTotals = Pick<
  Payslip,
  "basic_pay" | "absence_deduction" | "gross_pay" | "total_deductions" | "net_pay"
> & { sss: number; philhealth: number; pagibig: number };

export function payrollTotals(slips: Payslip[]): PayrollTotals {
  const sum = (pick: (p: Payslip) => number | null) =>
    toPesos(slips.reduce((s, p) => s + toCents(pick(p) ?? 0), 0));
  return {
    basic_pay: sum((p) => p.basic_pay),
    absence_deduction: sum((p) => p.absence_deduction),
    sss: sum((p) => p.sss_deduction),
    philhealth: sum((p) => p.philhealth_deduction),
    pagibig: sum((p) => p.pagibig_deduction),
    gross_pay: sum((p) => p.gross_pay),
    total_deductions: sum((p) => p.total_deductions),
    net_pay: sum((p) => p.net_pay),
  };
}

/** The figures that matter for "has anything changed since saving?". */
export function payslipFingerprint(p: Payslip): string {
  return [
    p.employee_id,
    p.salary_type,
    p.salary_rate,
    p.days_present,
    p.days_absent,
    p.days_leave,
    p.days_holiday,
    p.minutes_worked,
    p.basic_pay,
    p.absence_deduction,
    p.sss_deduction,
    p.philhealth_deduction,
    p.pagibig_deduction,
    p.net_pay,
  ].join("|");
}
