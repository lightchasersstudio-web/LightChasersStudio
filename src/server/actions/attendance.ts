"use server";

import { refresh } from "next/cache";

import { cutoffLabel } from "@/lib/payroll/cutoff";
import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import { attendanceSheetSchema } from "@/lib/validations/attendance";
import { adminAction, audit } from "@/server/admin-action";

/** Saves one employee's time record for a cut-off: changed days in, blanked days out. */
export async function saveAttendance(input: unknown): Promise<ActionResult> {
  return adminAction(
    attendanceSheetSchema,
    input,
    async ({ employeeId, cutoff, upserts, cleared }, ctx) => {
      const { data: employee, error: readError } = await ctx.supabase
        .from("employees")
        .select("full_name")
        .eq("id", employeeId)
        .maybeSingle();
      if (readError) throw readError;
      if (!employee) return fail("Employee not found.");

      if (upserts.length) {
        const { error } = await ctx.supabase
          .from("attendance_logs")
          .upsert(upserts, { onConflict: "employee_id,work_date" });
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
