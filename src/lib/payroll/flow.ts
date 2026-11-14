import { payslipFingerprint, type Payslip } from "@/lib/payroll/payslip";

/**
 * Has anything changed since the payroll was saved (time record, salaries,
 * benefits, rates or staff)? Compares every payslip's figures. Used to save a
 * cut-off's payslips only when they differ.
 */
export function payrollChanged(fresh: Payslip[], saved: Payslip[] | null): boolean {
  if (saved === null) return false;
  const key = (list: Payslip[]) => list.map(payslipFingerprint).sort().join("\n");
  return key(fresh) !== key(saved);
}

/**
 * A cut-off that is already over (and paid): only the people whose days were
 * just edited get a new payslip; everyone else keeps the one that was saved,
 * including staff deactivated since. Someone with no saved payslip there gets
 * one if they're on the fresh list. Sorted by name, like computePayroll.
 */
export function mergePastPayslips(
  saved: Payslip[],
  fresh: Payslip[],
  changedEmployeeIds: Iterable<string>,
): Payslip[] {
  const changed = new Set(changedEmployeeIds);
  const freshById = new Map(fresh.map((p) => [p.employee_id, p]));
  const kept = saved.map((s) =>
    changed.has(s.employee_id) ? (freshById.get(s.employee_id) ?? s) : s,
  );
  const savedIds = new Set(saved.map((s) => s.employee_id));
  const added = fresh.filter((p) => changed.has(p.employee_id) && !savedIds.has(p.employee_id));
  return [...kept, ...added].sort((a, b) => a.employee_name.localeCompare(b.employee_name));
}

/** Asked before saving days in a cut-off that's already over (and paid). */
export function pastCutoffWarning(cutoffLabel: string, names: string[]): string {
  const who = names.filter(Boolean);
  const list =
    who.length <= 1
      ? (who[0] ?? "this person")
      : `${who.slice(0, -1).join(", ")} and ${who.at(-1)}`;
  return `${cutoffLabel} is already over and paid. Saving changes the payslip of ${list}. Everyone else's payslip stays as it was saved. Continue?`;
}
