import { format, isValid, parseISO } from "date-fns";

import type { DayStatus } from "@/lib/payroll/cutoff";
import { computeDailyPay } from "@/lib/payroll/daily-pay";
import {
  categoryLabel,
  EMPLOYEE_CATEGORIES,
  isEmployeeCategory,
  type EmployeeCategory,
} from "@/lib/payroll/employees";
import { toPesos } from "@/lib/payroll/money";

// The daily payroll report (Sales report → Payroll): what the studio pays its
// staff for one day, from the time record. Gross pay only: contributions are
// deducted per cut-off.

export const DAILY_PAYROLL_NOTE =
  "Gross pay earned for the day. Government contributions (SSS, PhilHealth, Pag-IBIG) are deducted per payroll period and are not included here.";

/** "all", a category, or "none" (staff without a category yet). */
export type DailyPayrollFilter = "all" | EmployeeCategory | "none";

export const DAILY_PAYROLL_FILTERS: { value: DailyPayrollFilter; label: string }[] = [
  { value: "all", label: "All staff" },
  ...EMPLOYEE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
];

export function parseDailyPayrollFilter(value: unknown): DailyPayrollFilter {
  if (value === "none") return "none";
  return isEmployeeCategory(value) ? value : "all";
}

/** A "YYYY-MM-DD" date from a URL, or null. */
export function parseReportDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2100) return null;
  const d = parseISO(value);
  return isValid(d) && format(d, "yyyy-MM-dd") === value ? value : null;
}

/** One time record for the day, with what's needed to price it. */
export type DailyPayrollRecord = {
  employeeId: string;
  name: string;
  position: string;
  category: string | null;
  status: DayStatus;
  /** "HH:MM" or null */
  timeIn: string | null;
  timeOut: string | null;
  timeOutEdited: boolean;
  minutes: number;
  /** Pesos, saved with the record. */
  dailyRate: number;
  /** Pesos per overtime hour (present days only); null = not paid. */
  overtimeRate: number | null;
};

export type DailyPayrollRow = DailyPayrollRecord & { pay: number };

export type CategorySubtotal = {
  value: EmployeeCategory | "none";
  label: string;
  pay: number;
  people: number;
};

export type DailyPayroll = {
  date: string;
  filter: DailyPayrollFilter;
  /** Anything recorded that day, before the filter. */
  hasRecords: boolean;
  /** Rows in the filter, by category then name. */
  rows: DailyPayrollRow[];
  /** Sum of the rows' pay: the "Total payroll" card and the table footer. */
  total: number;
  /** Rows with pay above ₱0. */
  paidCount: number;
  /** Every category for the whole day (whatever the filter); "none" only when someone has none. */
  subtotals: CategorySubtotal[];
};

const ORDER = [...EMPLOYEE_CATEGORIES.map((c) => c.value), "none"];
const keyOf = (category: string | null): EmployeeCategory | "none" =>
  isEmployeeCategory(category) ? category : "none";

/** Prices every record with computeDailyPay and adds it all up in centavos. */
export function buildDailyPayroll({
  date,
  filter,
  records,
  shiftMinutes,
}: {
  date: string;
  filter: DailyPayrollFilter;
  records: DailyPayrollRecord[];
  /** Payroll settings → hours per day, for present days. */
  shiftMinutes: number;
}): DailyPayroll {
  const priced = records
    .map((r) => ({
      ...r,
      payCents: computeDailyPay({
        status: r.status,
        minutes: r.minutes,
        dailyRate: r.dailyRate,
        shiftMinutes,
        overtimeRate: r.overtimeRate,
      }).payCents,
    }))
    .sort(
      (a, b) =>
        ORDER.indexOf(keyOf(a.category)) - ORDER.indexOf(keyOf(b.category)) ||
        a.name.localeCompare(b.name),
    );

  const subtotals: CategorySubtotal[] = ORDER.flatMap((value) => {
    const inCategory = priced.filter((r) => keyOf(r.category) === value);
    if (value === "none" && inCategory.length === 0) return [];
    return [
      {
        value: value as CategorySubtotal["value"],
        label: categoryLabel(value === "none" ? null : value),
        pay: toPesos(inCategory.reduce((s, r) => s + r.payCents, 0)),
        people: inCategory.length,
      },
    ];
  });

  const shown = filter === "all" ? priced : priced.filter((r) => keyOf(r.category) === filter);
  const totalCents = shown.reduce((s, r) => s + r.payCents, 0);

  return {
    date,
    filter,
    hasRecords: records.length > 0,
    rows: shown.map(({ payCents, ...r }) => ({ ...r, pay: toPesos(payCents) })),
    total: toPesos(totalCents),
    paidCount: shown.filter((r) => r.payCents > 0).length,
    subtotals,
  };
}

/** "8:00 AM"; a time out before the time in is the next day. */
export function formatClock(time: string | null): string {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number) as [number, number];
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const endsNextDay = (timeIn: string | null, timeOut: string | null): boolean =>
  !!timeIn && !!timeOut && timeOut < timeIn;
