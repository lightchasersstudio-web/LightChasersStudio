"use server";

import { refresh } from "next/cache";

import { BENEFITS } from "@/lib/payroll/contributions";
import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import { contributionSettingsSchema, setBenefitSchema } from "@/lib/validations/payroll";
import { adminAction, audit } from "@/server/admin-action";

/** Switch one government contribution on or off for an employee. */
export async function setEmployeeBenefit(input: unknown): Promise<ActionResult> {
  return adminAction(setBenefitSchema, input, async ({ employeeId, benefit, enabled }, ctx) => {
    const column = BENEFITS.find((b) => b.key === benefit)!.column;
    // upsert: employees added before the benefits trigger existed get a row too.
    const { data, error } = await ctx.supabase
      .from("employee_benefits")
      .upsert(
        {
          employee_id: employeeId,
          ...({ [column]: enabled } as Partial<Record<typeof column, boolean>>),
        },
        { onConflict: "employee_id" },
      )
      .select("employee:employees(full_name)")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("Employee not found.");
    await audit(
      ctx,
      enabled ? "employee.benefit_on" : "employee.benefit_off",
      "employee",
      employeeId,
      {
        name: data.employee?.full_name ?? null,
        benefit,
      },
    );
    refresh();
    return ok(undefined);
  });
}

export async function updateContributionSettings(input: unknown): Promise<ActionResult> {
  return adminAction(contributionSettingsSchema, input, async (row, ctx) => {
    const { error } = await ctx.supabase.from("contribution_settings").update(row).eq("id", true);
    if (error) throw error;
    await audit(ctx, "payroll.rates", "contribution_settings", null, row);
    refresh();
    return ok(undefined);
  });
}
