"use server";

import { refresh } from "next/cache";

import { cutoffLabel } from "@/lib/payroll/cutoff";
import { asSalaryType, salaryRates } from "@/lib/payroll/employees";
import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import { attendanceSheetSchema } from "@/lib/validations/attendance";
import { adminAction, audit } from "@/server/admin-action";

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
      refresh();
      return ok(undefined);
    },
  );
}
