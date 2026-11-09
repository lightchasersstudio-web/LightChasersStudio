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
    /** Pesos per overtime hour; null = overtime isn't paid. */
    overtimeRate: number | null;
  };
  benefits: Record<Benefit, boolean>;
  /** One entry per recorded day; minutes = time between time in and time out. */
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
  hourly_rate: number;
  overtime_rate: number | null;
  days_present: number;
  days_absent: number;
  days_leave: number;
  days_holiday: number;
  minutes_worked: number;
  /** Present-day minutes up to a shift each day. */
  regular_minutes: number;
  /** Minutes short of a shift on present days. */
  undertime_minutes: number;
  /** Minutes past a shift on present days. */
  overtime_minutes: number;
  basic_pay: number;
  overtime_pay: number;
  absence_deduction: number;
  undertime_deduction: number;
  /** null = not enrolled */
  sss_deduction: number | null;
  philhealth_deduction: number | null;
  pagibig_deduction: number | null;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
};

/**
 * One employee's pay for a cut-off, by the hour (owner decisions 2026-11-09).
 * Daily rate = monthly ÷ days in a month (30); hourly rate = daily ÷ hours in
 * a shift (8). All time between time in and time out counts (no lunch break).
 *
 * - Monthly: basic = half the monthly salary. Each absent / leave / holiday
 *   day deducts a daily rate; each present day shorter than a shift deducts
 *   the missing time at the hourly rate (undertime). Together never more than basic.
 * - Daily: basic = daily rate × days present, minus undertime the same way.
 * - Overtime: time past a shift on a present day, paid at the employee's own
 *   overtime rate per hour (nothing when they have none).
 * - SSS / PhilHealth / Pag-IBIG: half the monthly employee share, from the
 *   monthly salary (daily × days in a month for daily staff); null when off.
 * - Gross = basic + overtime; deductions = absences + undertime +
 *   contributions; net = gross − deductions (can go below zero).
 */
export function computePayslip({ employee, benefits, days, rates, half }: PayslipInput): Payslip {
  const { monthly, daily } = salaryRates(
    employee.salaryType,
    employee.salaryRate,
    rates.workDaysPerMonth,
  );
  const shiftMinutes = Math.round(rates.hoursPerDay * 60);
  const dailyCents = toCents(daily);
  const t = dayTotals(days);
  const unpaidDays = t.absent + t.leave + t.holiday;

  let regular = 0;
  let undertime = 0;
  let overtime = 0;
  for (const d of days) {
    if (d.status !== "present") continue;
    regular += Math.min(d.minutes, shiftMinutes);
    undertime += Math.max(0, shiftMinutes - d.minutes);
    overtime += Math.max(0, d.minutes - shiftMinutes);
  }

  const basicCents =
    employee.salaryType === "monthly"
      ? toCents(cutoffShare(monthly, half))
      : dailyCents * t.present;
  const rawAbsence = employee.salaryType === "monthly" ? dailyCents * unpaidDays : 0;
  const rawUndertime = Math.round((dailyCents * undertime) / shiftMinutes);
  // Time off never takes more than the basic pay.
  const absenceCents = Math.min(basicCents, rawAbsence);
  const undertimeCents = Math.min(basicCents - absenceCents, rawUndertime);
  const overtimeCents =
    employee.overtimeRate === null
      ? 0
      : Math.round((toCents(employee.overtimeRate) * overtime) / 60);

  const shares = monthlyContributions(monthly, rates);
  const share = (b: Benefit) => (benefits[b] ? cutoffShare(shares[b].monthly, half) : null);
  const sss = share("sss");
  const philhealth = share("philhealth");
  const pagibig = share("pagibig");

  const grossCents = basicCents + overtimeCents;
  const totalCents =
    absenceCents +
    undertimeCents +
    toCents(sss ?? 0) +
    toCents(philhealth ?? 0) +
    toCents(pagibig ?? 0);

  return {
    employee_id: employee.id,
    employee_name: employee.name,
    employee_position: employee.position,
    salary_type: employee.salaryType,
    salary_rate: employee.salaryRate,
    daily_rate: daily,
    monthly_salary: monthly,
    hourly_rate: toPesos(Math.round(dailyCents / rates.hoursPerDay)),
    overtime_rate: employee.overtimeRate,
    days_present: t.present,
    days_absent: t.absent,
    days_leave: t.leave,
    days_holiday: t.holiday,
    minutes_worked: t.minutes,
    regular_minutes: regular,
    undertime_minutes: undertime,
    overtime_minutes: overtime,
    basic_pay: toPesos(basicCents),
    overtime_pay: toPesos(overtimeCents),
    absence_deduction: toPesos(absenceCents),
    undertime_deduction: toPesos(undertimeCents),
    sss_deduction: sss,
    philhealth_deduction: philhealth,
    pagibig_deduction: pagibig,
    gross_pay: toPesos(grossCents),
    total_deductions: toPesos(totalCents),
    net_pay: toPesos(grossCents - totalCents),
  };
}

export type PayrollTotals = Pick<
  Payslip,
  | "basic_pay"
  | "overtime_pay"
  | "absence_deduction"
  | "undertime_deduction"
  | "gross_pay"
  | "total_deductions"
  | "net_pay"
> & { sss: number; philhealth: number; pagibig: number };

export function payrollTotals(slips: Payslip[]): PayrollTotals {
  const sum = (pick: (p: Payslip) => number | null) =>
    toPesos(slips.reduce((s, p) => s + toCents(pick(p) ?? 0), 0));
  return {
    basic_pay: sum((p) => p.basic_pay),
    overtime_pay: sum((p) => p.overtime_pay),
    absence_deduction: sum((p) => p.absence_deduction),
    undertime_deduction: sum((p) => p.undertime_deduction),
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
    p.overtime_rate,
    p.days_present,
    p.days_absent,
    p.days_leave,
    p.days_holiday,
    p.minutes_worked,
    p.undertime_minutes,
    p.overtime_minutes,
    p.basic_pay,
    p.overtime_pay,
    p.absence_deduction,
    p.undertime_deduction,
    p.sss_deduction,
    p.philhealth_deduction,
    p.pagibig_deduction,
    p.net_pay,
  ].join("|");
}
