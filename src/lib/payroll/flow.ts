import { payslipFingerprint, type Payslip } from "@/lib/payroll/payslip";

/**
 * Where a cut-off stands in the payroll steps:
 * 1 Record days (Time record) → 2 Save the payroll → 3 Print payslips.
 */
export type PayrollFlow = {
  /** Active staff on the time record. */
  staff: number;
  /** Staff with every day of the cut-off recorded. */
  staffComplete: number;
  savedAt: string | null;
  /** Saved, but the time record, salaries, benefits, rates or staff changed since. */
  changed: boolean;
};

export type PayrollStepId = "record" | "payroll" | "payslips";

/** Has anything changed since the payroll was saved? Compares every payslip's figures. */
export function payrollChanged(fresh: Payslip[], saved: Payslip[] | null): boolean {
  if (saved === null) return false;
  const key = (list: Payslip[]) => list.map(payslipFingerprint).sort().join("\n");
  return key(fresh) !== key(saved);
}

/** Every recorded day counts; a cut-off still running is never complete. */
export function staffComplete(rows: { recorded: number }[], days: number): number {
  return rows.filter((r) => r.recorded >= days).length;
}

export function stepDone(flow: PayrollFlow, step: PayrollStepId): boolean {
  switch (step) {
    case "record":
      return flow.staff > 0 && flow.staffComplete === flow.staff;
    case "payroll":
    case "payslips":
      return flow.savedAt !== null && !flow.changed;
  }
}

/**
 * The step to do next: payslips once the payroll is saved and up to date,
 * else the payroll once every day is recorded, else recording days.
 */
export function nextStep(flow: PayrollFlow): PayrollStepId {
  if (stepDone(flow, "payroll")) return "payslips";
  if (stepDone(flow, "record")) return "payroll";
  return "record";
}

export type MissingDays = { id: string; name: string; dates: string[] };

/**
 * Staff with days left blank so far: every day of the cut-off up to today
 * (later days can't be recorded yet). Blank days don't count in the payslip.
 */
export function missingDays(
  rows: { id: string; name: string; dates: string[] }[],
  cutoffDates: string[],
  today: string,
): MissingDays[] {
  const due = cutoffDates.filter((d) => d <= today);
  return rows.flatMap((r) => {
    const recorded = new Set(r.dates);
    const dates = due.filter((d) => !recorded.has(d));
    return dates.length ? [{ id: r.id, name: r.name, dates }] : [];
  });
}
