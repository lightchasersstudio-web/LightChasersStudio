import { toCents, toPesos } from "@/lib/payroll/money";

/** contribution_settings as numbers (rates are fractions: 0.05 = 5%). */
export type ContributionRates = {
  sssEmployeeRate: number;
  sssMscMin: number;
  sssMscMax: number;
  sssMscStep: number;
  philhealthEmployeeRate: number;
  philhealthFloor: number;
  philhealthCeiling: number;
  pagibigEmployeeRate: number;
  pagibigSalaryCap: number;
  /** Days in a month: daily rate = monthly ÷ this. */
  workDaysPerMonth: number;
  /** Hours in a shift: hourly rate = daily ÷ this; more is overtime, less is undertime. */
  hoursPerDay: number;
};

/** The 2026 defaults (same as the migration), for tests and empty states. */
export const DEFAULT_RATES: ContributionRates = {
  sssEmployeeRate: 0.05,
  sssMscMin: 5000,
  sssMscMax: 35000,
  sssMscStep: 500,
  philhealthEmployeeRate: 0.025,
  philhealthFloor: 10000,
  philhealthCeiling: 100000,
  pagibigEmployeeRate: 0.02,
  pagibigSalaryCap: 10000,
  workDaysPerMonth: 30,
  hoursPerDay: 8,
};

type Numeric = number | string;

export function ratesFromRow(row: {
  sss_employee_rate: Numeric;
  sss_msc_min: Numeric;
  sss_msc_max: Numeric;
  sss_msc_step: Numeric;
  philhealth_employee_rate: Numeric;
  philhealth_floor: Numeric;
  philhealth_ceiling: Numeric;
  pagibig_employee_rate: Numeric;
  pagibig_salary_cap: Numeric;
  work_days_per_month: Numeric;
  hours_per_day: Numeric;
}): ContributionRates {
  return {
    sssEmployeeRate: Number(row.sss_employee_rate),
    sssMscMin: Number(row.sss_msc_min),
    sssMscMax: Number(row.sss_msc_max),
    sssMscStep: Number(row.sss_msc_step),
    philhealthEmployeeRate: Number(row.philhealth_employee_rate),
    philhealthFloor: Number(row.philhealth_floor),
    philhealthCeiling: Number(row.philhealth_ceiling),
    pagibigEmployeeRate: Number(row.pagibig_employee_rate),
    pagibigSalaryCap: Number(row.pagibig_salary_cap),
    workDaysPerMonth: Number(row.work_days_per_month),
    hoursPerDay: Number(row.hours_per_day),
  };
}

export const BENEFITS = [
  { key: "sss", label: "SSS", column: "sss_enabled" },
  { key: "philhealth", label: "PhilHealth", column: "philhealth_enabled" },
  { key: "pagibig", label: "Pag-IBIG", column: "pagibig_enabled" },
] as const;
export type Benefit = (typeof BENEFITS)[number]["key"];

/**
 * SSS Monthly Salary Credit: the salary rounded to the nearest step (₱5,250 →
 * ₱5,500, ₱5,249.99 → ₱5,000), kept between the lowest and highest MSC.
 */
export function sssMsc(monthlySalary: number, r: ContributionRates): number {
  const step = toCents(r.sssMscStep);
  const rounded = Math.floor((toCents(monthlySalary) + step / 2) / step) * step;
  return toPesos(Math.min(toCents(r.sssMscMax), Math.max(toCents(r.sssMscMin), rounded)));
}

export type Contribution = {
  /** What the share is worked out from (MSC for SSS). */
  base: number;
  monthly: number;
};

/** Employee shares per month, before switching any off. */
export function monthlyContributions(
  monthlySalary: number,
  r: ContributionRates,
): Record<Benefit, Contribution> {
  const share = (base: number, rate: number) => ({
    base,
    monthly: toPesos(Math.round(toCents(base) * rate)),
  });
  const philhealthBase = Math.min(r.philhealthCeiling, Math.max(r.philhealthFloor, monthlySalary));
  return {
    sss: share(sssMsc(monthlySalary, r), r.sssEmployeeRate),
    philhealth: share(philhealthBase, r.philhealthEmployeeRate),
    pagibig: share(Math.min(monthlySalary, r.pagibigSalaryCap), r.pagibigEmployeeRate),
  };
}

/**
 * Half of a monthly contribution for one cut-off. The two halves always add
 * up to the month: the 1st–15th takes the lower half, the 16th–end the rest.
 */
export function cutoffShare(monthly: number, half: 1 | 2): number {
  const cents = toCents(monthly);
  const first = Math.floor(cents / 2);
  return toPesos(half === 1 ? first : cents - first);
}
