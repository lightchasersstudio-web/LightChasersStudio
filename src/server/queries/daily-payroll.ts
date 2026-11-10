import "server-only";

import { isDayStatus } from "@/lib/payroll/cutoff";
import {
  buildDailyPayroll,
  type DailyPayroll,
  type DailyPayrollFilter,
  type DailyPayrollRecord,
} from "@/lib/payroll/daily-report";
import { createClient } from "@/lib/supabase/server";

/**
 * Every time record on a Manila date (work_date), priced on the server from
 * the rate saved with each record. Reads through RLS as the signed-in admin;
 * callers check requireAdmin() / assertAdmin().
 */
export async function getDailyPayroll(
  date: string,
  filter: DailyPayrollFilter,
): Promise<DailyPayroll> {
  const supabase = await createClient();
  const [logs, settings] = await Promise.all([
    supabase
      .from("attendance_logs")
      .select(
        "employee_id, status, time_in, time_out, time_out_edited, minutes_worked, daily_rate, employee:employees!inner(full_name, position, category, overtime_rate, deleted_at)",
      )
      .eq("work_date", date)
      // Deleted staff leave the report (their records stay for their history).
      .is("employee.deleted_at", null),
    supabase.from("contribution_settings").select("hours_per_day").single(),
  ]);
  if (logs.error) throw logs.error;
  if (settings.error) throw settings.error;

  const records: DailyPayrollRecord[] = logs.data.flatMap((l) =>
    isDayStatus(l.status) && l.employee
      ? [
          {
            employeeId: l.employee_id,
            name: l.employee.full_name,
            position: l.employee.position,
            category: l.employee.category,
            status: l.status,
            timeIn: l.time_in?.slice(0, 5) ?? null,
            timeOut: l.time_out?.slice(0, 5) ?? null,
            timeOutEdited: l.time_out_edited ?? false,
            minutes: l.minutes_worked ?? 0,
            dailyRate: Number(l.daily_rate),
            overtimeRate:
              l.employee.overtime_rate === null ? null : Number(l.employee.overtime_rate),
          },
        ]
      : [],
  );

  return buildDailyPayroll({
    date,
    filter,
    records,
    shiftMinutes: Math.round(Number(settings.data.hours_per_day) * 60),
  });
}
