"use server";

import { refresh } from "next/cache";

import { cutoffFor, cutoffLabel } from "@/lib/payroll/cutoff";
import { asSalaryType, salaryRates } from "@/lib/payroll/employees";
import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import { attendanceDaySchema, attendanceSheetSchema } from "@/lib/validations/attendance";
import { adminAction, audit } from "@/server/admin-action";
import { syncPayroll } from "@/server/payroll-sync";

/** Saves one employee's time record for a cut-off: changed days in, blanked days out. */
export async function saveAttendance(input: unknown): Promise<ActionResult> {
  return adminAction(
    attendanceSheetSchema,
    input,
    async ({ employeeId, cutoff, upserts, cleared }, ctx) => {
      const [{ data: employee, error: readError }, settings] = await Promise.all([
        ctx.supabase
          .from("employees")
          .select("full_name, salary_type, salary_rate, deleted_at")
          .eq("id", employeeId)
          .maybeSingle(),
        ctx.supabase
          .from("contribution_settings")
          .select("work_days_per_month, am_pm_rate")
          .single(),
      ]);
      if (readError) throw readError;
      if (settings.error) throw settings.error;
      if (!employee || employee.deleted_at) return fail("Employee not found.");

      // A day saved without a rate gets the employee's daily rate today; it
      // stays on the record, so later salary changes don't touch past days.
      const { daily } = salaryRates(
        asSalaryType(employee.salary_type),
        Number(employee.salary_rate),
        Number(settings.data.work_days_per_month),
      );

      if (upserts.length) {
        const { error } = await ctx.supabase.from("attendance_logs").upsert(
          upserts.map((u) => ({
            ...u,
            // AM/PM: the AM/PM rate from Payroll settings; others: today's daily rate.
            daily_rate:
              u.daily_rate ?? (u.status === "am_pm" ? Number(settings.data.am_pm_rate) : daily),
          })),
          { onConflict: "employee_id,work_date" },
        );
        if (error) throw error;
      }
      if (cleared.length) {
        const { error } = await ctx.supabase
          .from("attendance_logs")
          .delete()
          .eq("employee_id", employeeId)
          .in("work_date", cleared);
        if (error) throw error;
      }
      await audit(ctx, "attendance.update", "employee", employeeId, {
        name: employee.full_name,
        cutoff: cutoffLabel(cutoff),
      });
      // One save: the cut-off's payslips follow the time record.
      await syncPayroll(cutoff, ctx, [employeeId]);
      refresh();
      return ok(undefined);
    },
  );
}

/**
 * Saves the whole team's records for one day (Time record → By day): filled
 * rows in, rows set to "Not recorded" out. The page sends only the rows it
 * changed, so two people saving different staff don't undo each other.
 */
export async function saveAttendanceDay(input: unknown): Promise<ActionResult> {
  return adminAction(attendanceDaySchema, input, async ({ date, upserts, cleared }, ctx) => {
    const ids = [...upserts.map((u) => u.employee_id), ...cleared];
    if (ids.length === 0) return ok(undefined);
    const [{ data: employees, error: readError }, settings] = await Promise.all([
      ctx.supabase
        .from("employees")
        .select("id, salary_type, salary_rate, deleted_at")
        .in("id", ids),
      ctx.supabase.from("contribution_settings").select("work_days_per_month, am_pm_rate").single(),
    ]);
    if (readError) throw readError;
    if (settings.error) throw settings.error;
    const byId = new Map(employees.map((e) => [e.id, e]));
    if (ids.some((id) => !byId.get(id) || byId.get(id)!.deleted_at)) {
      return fail("Someone on this list was deleted. Reload the page and try again.");
    }

    if (upserts.length) {
      const { error } = await ctx.supabase.from("attendance_logs").upsert(
        upserts.map((u) => {
          const e = byId.get(u.employee_id)!;
          // Same rule as the sheet: a blank rate = AM/PM rate or today's daily rate.
          const daily = salaryRates(
            asSalaryType(e.salary_type),
            Number(e.salary_rate),
            Number(settings.data.work_days_per_month),
          ).daily;
          return {
            ...u,
            daily_rate:
              u.daily_rate ?? (u.status === "am_pm" ? Number(settings.data.am_pm_rate) : daily),
          };
        }),
        { onConflict: "employee_id,work_date" },
      );
      if (error) throw error;
    }
    if (cleared.length) {
      const { error } = await ctx.supabase
        .from("attendance_logs")
        .delete()
        .eq("work_date", date)
        .in("employee_id", cleared);
      if (error) throw error;
    }
    await audit(ctx, "attendance.update_day", "attendance", null, {
      date,
      staff: upserts.length,
    });
    // One save: the cut-off's payslips follow the time record.
    await syncPayroll(cutoffFor(date), ctx, ids);
    refresh();
    return ok(undefined);
  });
}
