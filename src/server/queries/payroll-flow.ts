import "server-only";

import { cutoffDates, type Cutoff } from "@/lib/payroll/cutoff";
import { missingDays, payrollChanged, staffComplete, type PayrollFlow } from "@/lib/payroll/flow";
import { businessToday } from "@/lib/utils/business-date";
import { getCutoffSummary } from "@/server/queries/attendance";
import { computePayroll, getSavedPayroll } from "@/server/queries/payroll";

/**
 * Everything the Time record and Payroll pages need to show where a cut-off
 * stands (the steps bar), plus the data they render themselves.
 */
export async function getPayrollFlow(cutoff: Cutoff) {
  const [summary, fresh, saved] = await Promise.all([
    getCutoffSummary(cutoff),
    computePayroll(cutoff),
    getSavedPayroll(cutoff),
  ]);
  const changed = payrollChanged(fresh, saved?.payslips ?? null);
  const flow: PayrollFlow = {
    staff: summary.length,
    staffComplete: staffComplete(summary, cutoffDates(cutoff).length),
    savedAt: saved?.savedAt ?? null,
    changed,
  };
  // Staff with blank days so far (they don't count in the payslip).
  const missing = missingDays(summary, cutoffDates(cutoff), businessToday());
  return { summary, fresh, saved, changed, flow, missing };
}
