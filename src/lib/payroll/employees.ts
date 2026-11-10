import { toCents, toPesos } from "@/lib/payroll/money";

export const SALARY_TYPES = [
  { value: "monthly", label: "Monthly salary" },
  { value: "daily", label: "Daily rate" },
] as const;
export type SalaryType = (typeof SALARY_TYPES)[number]["value"];

/** What an employee mainly works on (daily payroll report). */
export const EMPLOYEE_CATEGORIES = [
  { value: "events", label: "Events" },
  { value: "photobooth", label: "Photobooth" },
  { value: "studio", label: "Studio" },
] as const;
export type EmployeeCategory = (typeof EMPLOYEE_CATEGORIES)[number]["value"];

export const isEmployeeCategory = (v: unknown): v is EmployeeCategory =>
  EMPLOYEE_CATEGORIES.some((c) => c.value === v);

/** Staff added before categories existed have none yet. */
export const UNCATEGORIZED = "Uncategorized";

export const categoryLabel = (category: string | null): string =>
  EMPLOYEE_CATEGORIES.find((c) => c.value === category)?.label ?? UNCATEGORIZED;

export const asSalaryType = (value: string): SalaryType =>
  value === "daily" ? "daily" : "monthly";

/** Government numbers: digit count and how they're written. */
export const GOV_IDS = {
  sss: { label: "SSS no.", digits: 10, groups: [2, 7, 1], example: "34-1234567-8" },
  philhealth: { label: "PhilHealth no.", digits: 12, groups: [2, 9, 1], example: "12-345678901-2" },
  pagibig: { label: "Pag-IBIG MID no.", digits: 12, groups: [4, 4, 4], example: "1234-5678-9012" },
} as const;
export type GovId = keyof typeof GOV_IDS;

/** "3412345678" → "34-1234567-8". Anything unexpected is shown as stored. */
export function formatGovId(kind: GovId, digits: string | null): string | null {
  if (!digits) return null;
  const { groups, digits: count } = GOV_IDS[kind];
  if (digits.length !== count) return digits;
  const parts: string[] = [];
  let at = 0;
  for (const size of groups) {
    parts.push(digits.slice(at, at + size));
    at += size;
  }
  return parts.join("-");
}

/**
 * A monthly salary's daily rate, or a daily rate's monthly equivalent (used
 * for contributions), with `workDays` working days in a month.
 */
export function salaryRates(
  type: SalaryType,
  rate: number,
  workDays: number,
): { monthly: number; daily: number } {
  const cents = toCents(rate);
  return type === "monthly"
    ? { monthly: toPesos(cents), daily: toPesos(Math.round(cents / workDays)) }
    : { monthly: toPesos(Math.round(cents * workDays)), daily: toPesos(cents) };
}
