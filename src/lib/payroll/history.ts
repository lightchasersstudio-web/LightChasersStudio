import { computeDailyPay } from "@/lib/payroll/daily-pay";
import { cutoffLabel, isDayStatus, parseCutoff } from "@/lib/payroll/cutoff";
import { toCents } from "@/lib/payroll/money";

// Payroll history (owner request 2026-11-14): net pay per year and month from
// the saved payslips, and each day's pay from the time record. Deductions (SSS,
// PhilHealth, Pag-IBIG) come off once per cut-off, so a day shows the pay
// earned that day before them. All sums in centavos.

export type SavedPeriod = {
  start: string;
  payslips: {
    net_pay: number | string;
    gross_pay: number | string;
    total_deductions: number | string;
  }[];
};

export type Totals = { grossCents: number; deductionsCents: number; netCents: number };

export type CutoffTotal = Totals & { start: string; label: string; people: number };
export type MonthTotal = Totals & { month: string; cutoffs: CutoffTotal[] };
export type YearTotal = Totals & { year: string; months: MonthTotal[] };

const add = (a: Totals, b: Totals): Totals => ({
  grossCents: a.grossCents + b.grossCents,
  deductionsCents: a.deductionsCents + b.deductionsCents,
  netCents: a.netCents + b.netCents,
});
const ZERO: Totals = { grossCents: 0, deductionsCents: 0, netCents: 0 };

/** Saved payrolls → years (newest first) → months (Jan first) → cut-offs. */
export function payrollYears(periods: SavedPeriod[]): YearTotal[] {
  const cutoffs: CutoffTotal[] = periods
    .flatMap((p) => {
      const c = parseCutoff(p.start);
      if (!c) return [];
      const totals = p.payslips.reduce<Totals>(
        (t, s) =>
          add(t, {
            grossCents: toCents(Number(s.gross_pay)),
            deductionsCents: toCents(Number(s.total_deductions)),
            netCents: toCents(Number(s.net_pay)),
          }),
        ZERO,
      );
      return [{ ...totals, start: c.start, label: cutoffLabel(c), people: p.payslips.length }];
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  const months = new Map<string, MonthTotal>();
  for (const c of cutoffs) {
    const key = c.start.slice(0, 7);
    const m = months.get(key) ?? { ...ZERO, month: key, cutoffs: [] };
    months.set(key, { ...add(m, c), month: key, cutoffs: [...m.cutoffs, c] });
  }
  const years = new Map<string, YearTotal>();
  for (const m of months.values()) {
    const key = m.month.slice(0, 4);
    const y = years.get(key) ?? { ...ZERO, year: key, months: [] };
    years.set(key, { ...add(y, m), year: key, months: [...y.months, m] });
  }
  return [...years.values()].sort((a, b) => b.year.localeCompare(a.year));
}

export type DayRecord = {
  date: string;
  /** The employee, as they appear in the day's list. */
  name: string;
  status: string;
  minutes: number;
  dailyRate: number;
  overtimeRate: number | null;
};

/** One person's pay on a day. */
export type DayPerson = { name: string; status: string; payCents: number };

/** A day: people paid, the total, and each person (by name). */
export type DayTotal = { date: string; people: number; payCents: number; staff: DayPerson[] };

/** Time records → each day's pay (people paid, total), in date order. */
export function payrollDays(records: DayRecord[], shiftMinutes: number): DayTotal[] {
  const days = new Map<string, DayTotal>();
  for (const r of records) {
    if (!isDayStatus(r.status)) continue;
    const { payCents } = computeDailyPay({
      status: r.status,
      minutes: r.minutes,
      dailyRate: r.dailyRate,
      shiftMinutes,
      overtimeRate: r.overtimeRate,
    });
    const d = days.get(r.date) ?? { date: r.date, people: 0, payCents: 0, staff: [] };
    days.set(r.date, {
      date: r.date,
      people: d.people + (payCents > 0 ? 1 : 0),
      payCents: d.payCents + payCents,
      staff: [...d.staff, { name: r.name, status: r.status, payCents }],
    });
  }
  return [...days.values()]
    .map((d) => ({ ...d, staff: d.staff.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
