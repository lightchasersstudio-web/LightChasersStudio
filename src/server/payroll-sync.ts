import "server-only";

import { cutoffLabel, type Cutoff } from "@/lib/payroll/cutoff";
import { mergePastPayslips, payrollChanged } from "@/lib/payroll/flow";
import { payrollTotals, type Payslip } from "@/lib/payroll/payslip";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessToday } from "@/lib/utils/business-date";
import { audit } from "@/server/admin-action";
import { computePayroll, getSavedPayroll } from "@/server/queries/payroll";

// One save (owner request 2026-11-14): there is no "save the payroll" step any
// more. Saving days on the time record keeps that cut-off's payslips saved, and
// printing saves them too, so the saved payslips (kept for 3 years) always match
// what was recorded and printed.

/** A cut-off whose last day has passed: its saved payslips are what was paid. */
export const cutoffEnded = (cutoff: Cutoff, today: string = businessToday()) => cutoff.end < today;

/**
 * Saves a cut-off's payslips worked out from the database, unless the saved ones
 * already match. Returns the payslips now saved (empty when nobody is active).
 *
 * `changedEmployeeIds`: whose days were just edited. In a cut-off that is over
 * and saved, only their payslips are redone; everyone else keeps the saved one
 * (owner decision 2026-11-14), so a later raise, a deactivation or new
 * contribution rates never change past pay by accident. Without it (printing a
 * never-saved cut-off), the whole cut-off is worked out.
 *
 * Callers must have checked admin access (SERVICE ROLE write).
 */
export async function syncPayroll(
  cutoff: Cutoff,
  ctx: Parameters<typeof audit>[0],
  changedEmployeeIds?: string[],
): Promise<Payslip[]> {
  const [fresh, saved] = await Promise.all([computePayroll(cutoff), getSavedPayroll(cutoff)]);
  const past = saved !== null && changedEmployeeIds !== undefined && cutoffEnded(cutoff);
  const next = past ? mergePastPayslips(saved.payslips, fresh, changedEmployeeIds) : fresh;
  if (!next.length) return saved?.payslips ?? [];
  if (saved && !payrollChanged(next, saved.payslips)) return saved.payslips;

  const { error } = await createAdminClient().rpc("save_payroll", {
    p_period_start: cutoff.start,
    p_period_end: cutoff.end,
    p_payslips: next,
    p_saved_by: ctx.admin.userId,
  });
  if (error) throw error;

  await audit(ctx, "payroll.save", "payroll_period", null, {
    name: cutoffLabel(cutoff), // shown on the Activity page
    start: cutoff.start,
    employees: next.length,
    net: payrollTotals(next).net_pay,
    ...(past && { redone_for: changedEmployeeIds.length }),
  });
  return next;
}
