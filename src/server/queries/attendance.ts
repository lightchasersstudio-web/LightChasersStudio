import "server-only";

import { dayTotals, isDayStatus, type Cutoff, type DayTotals } from "@/lib/payroll/cutoff";
import { createClient } from "@/lib/supabase/server";

export type AttendanceLog = {
  date: string;
  status: "present" | "absent" | "leave" | "holiday";
  timeIn: string | null;
  timeOut: string | null;
  minutes: number;
  note: string | null;
};

/** One employee's records in a cut-off, by date. Callers check requireAdmin(). */
export async function getAttendance(employeeId: string, cutoff: Cutoff): Promise<AttendanceLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("work_date, status, time_in, time_out, minutes_worked, note")
    .eq("employee_id", employeeId)
    .gte("work_date", cutoff.start)
    .lte("work_date", cutoff.end)
    .order("work_date");
  if (error) throw error;
  return data.flatMap((r) =>
    isDayStatus(r.status)
      ? [
          {
            date: r.work_date,
            status: r.status,
            timeIn: r.time_in?.slice(0, 5) ?? null,
            timeOut: r.time_out?.slice(0, 5) ?? null,
            minutes: r.minutes_worked ?? 0,
            note: r.note,
          },
        ]
      : [],
  );
}

export type CutoffSummaryRow = {
  id: string;
  name: string;
  position: string;
  isActive: boolean;
  /** Days with something recorded. */
  recorded: number;
  totals: DayTotals;
};

/**
 * Active staff's totals for a cut-off (owner decision 2026-11-09: deactivated
 * staff don't show in the time record; their records are kept).
 */
export async function getCutoffSummary(cutoff: Cutoff): Promise<CutoffSummaryRow[]> {
  const supabase = await createClient();
  const [employees, logs] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, position, is_active")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("attendance_logs")
      .select("employee_id, status, minutes_worked")
      .gte("work_date", cutoff.start)
      .lte("work_date", cutoff.end),
  ]);
  if (employees.error) throw employees.error;
  if (logs.error) throw logs.error;

  const byEmployee = new Map<string, { status: AttendanceLog["status"]; minutes: number }[]>();
  for (const l of logs.data) {
    if (!isDayStatus(l.status)) continue;
    const list = byEmployee.get(l.employee_id) ?? [];
    list.push({ status: l.status, minutes: l.minutes_worked ?? 0 });
    byEmployee.set(l.employee_id, list);
  }
  return employees.data.map((e) => {
    const days = byEmployee.get(e.id) ?? [];
    return {
      id: e.id,
      name: e.full_name,
      position: e.position,
      isActive: e.is_active,
      recorded: days.length,
      totals: dayTotals(days),
    };
  });
}

/** When the payroll for this cut-off was saved, if it was. */
export async function getPayrollSavedAt(cutoff: Cutoff): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_periods")
    .select("saved_at")
    .eq("period_start", cutoff.start)
    .maybeSingle();
  if (error) throw error;
  return data?.saved_at ?? null;
}
