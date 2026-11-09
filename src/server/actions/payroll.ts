"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { cutoffLabel, parseCutoff } from "@/lib/payroll/cutoff";
import { payrollTotals } from "@/lib/payroll/payslip";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import { adminAction, audit } from "@/server/admin-action";
import { computePayroll } from "@/server/queries/payroll";

const savePayrollSchema = z.object({ cutoff: z.string() });

/**
 * Saves (or replaces) a cut-off's payroll. The payslips are worked out again
 * here from the database, never taken from the browser.
 */
export async function savePayroll(input: unknown): Promise<ActionResult<{ count: number }>> {
  return adminAction(savePayrollSchema, input, async ({ cutoff: id }, ctx) => {
    const cutoff = parseCutoff(id);
    if (!cutoff) return fail("Pick a cut-off.");
    const payslips = await computePayroll(cutoff);
    if (!payslips.length) return fail("There are no active employees to pay.");

    const { error } = await createAdminClient().rpc("save_payroll", {
      p_period_start: cutoff.start,
      p_period_end: cutoff.end,
      p_payslips: payslips,
      p_saved_by: ctx.admin.userId,
    });
    if (error) throw error;

    await audit(ctx, "payroll.save", "payroll_period", null, {
      name: cutoffLabel(cutoff), // shown on the Activity page
      start: cutoff.start,
      employees: payslips.length,
      net: payrollTotals(payslips).net_pay,
    });
    refresh();
    return ok({ count: payslips.length });
  });
}
