"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import {
  employeeIdSchema,
  employeeSchema,
  setEmployeeActiveSchema,
} from "@/lib/validations/employees";
import { adminAction, audit } from "@/server/admin-action";
import type { Database } from "@/types/database.types";
import { refresh } from "next/cache";

async function removePhoto(supabase: SupabaseClient<Database>, path: string | null) {
  if (!path) return;
  const { error } = await supabase.storage.from("employee-photos").remove([path]);
  if (error) console.error("[employees] photo cleanup", error.message);
}

export async function createEmployee(input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction(employeeSchema, input, async (row, ctx) => {
    const { data, error } = await ctx.supabase.from("employees").insert(row).select("id").single();
    if (error) {
      await removePhoto(ctx.supabase, row.photo_path);
      throw error;
    }
    await audit(ctx, "employee.create", "employee", data.id, { name: row.full_name });
    refresh();
    return ok({ id: data.id });
  });
}

export async function updateEmployee(id: string, input: unknown): Promise<ActionResult> {
  return adminAction(employeeSchema, input, async (row, ctx) => {
    if (!employeeIdSchema.safeParse({ id }).success) return fail("Employee not found.");
    const { data: before, error: readError } = await ctx.supabase
      .from("employees")
      .select("photo_path, salary_type, salary_rate, deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!before) return fail("Employee not found.");
    if (before.deleted_at) return fail("This employee was deleted. Restore them to make changes.");

    const { error } = await ctx.supabase.from("employees").update(row).eq("id", id);
    if (error) throw error;
    if (before.photo_path !== row.photo_path) await removePhoto(ctx.supabase, before.photo_path);

    const salaryChanged =
      before.salary_type !== row.salary_type || Number(before.salary_rate) !== row.salary_rate;
    await audit(ctx, "employee.update", "employee", id, {
      name: row.full_name,
      ...(salaryChanged && {
        salary: {
          from: [before.salary_type, Number(before.salary_rate)],
          to: [row.salary_type, row.salary_rate],
        },
      }),
    });
    refresh();
    return ok(undefined);
  });
}

/**
 * Deletes an employee: hidden from Employees, the time record, payroll and
 * the daily payroll report. Their time records and saved payslips are kept
 * for Employees → Deleted, and restoreEmployee() brings them back.
 */
export async function deleteEmployee(input: unknown): Promise<ActionResult> {
  return adminAction(employeeIdSchema, input, async ({ id }, ctx) => {
    const { data, error } = await ctx.supabase
      .from("employees")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: ctx.admin.userId,
        is_active: false,
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("full_name")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("Employee not found.");
    await audit(ctx, "employee.delete", "employee", id, { name: data.full_name });
    refresh();
    return ok(undefined);
  });
}

/** Brings a deleted employee back as active, with every record they had. */
export async function restoreEmployee(input: unknown): Promise<ActionResult> {
  return adminAction(employeeIdSchema, input, async ({ id }, ctx) => {
    const { data, error } = await ctx.supabase
      .from("employees")
      .update({ deleted_at: null, deleted_by: null, is_active: true })
      .eq("id", id)
      .not("deleted_at", "is", null)
      .select("full_name")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("Employee not found.");
    await audit(ctx, "employee.restore", "employee", id, { name: data.full_name });
    refresh();
    return ok(undefined);
  });
}

export async function setEmployeeActive(input: unknown): Promise<ActionResult> {
  return adminAction(setEmployeeActiveSchema, input, async ({ id, isActive }, ctx) => {
    const { data, error } = await ctx.supabase
      .from("employees")
      .update({ is_active: isActive })
      .eq("id", id)
      .is("deleted_at", null)
      .select("full_name")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("Employee not found.");
    await audit(ctx, isActive ? "employee.activate" : "employee.deactivate", "employee", id, {
      name: data.full_name,
    });
    refresh();
    return ok(undefined);
  });
}
