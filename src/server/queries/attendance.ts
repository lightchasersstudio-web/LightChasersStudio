import "server-only";

import {
  dayTotals,
  isDayStatus,
  type Cutoff,
  type DayStatus,
  type DayTotals,
} from "@/lib/payroll/cutoff";
import { createClient } from "@/lib/supabase/server";

export type AttendanceLog = {
  date: string;
  status: DayStatus;
  timeIn: string | null;
  timeOut: string | null;
  minutes: number;
  /** Pesos, saved with the record. */
  dailyRate: number;
  /** An AM/PM time out changed from time in + 8 hours. */
  timeOutEdited: boolean;
  note: string | null;
};

/** One employee's records in a cut-off, by date. Callers check requireAdmin(). */
export async function getAttendance(employeeId: string, cutoff: Cutoff): Promise<AttendanceLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_logs")
    .select(
      "work_date, status, time_in, time_out, minutes_worked, daily_rate, time_out_edited, note",
    )
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
            dailyRate: Number(r.daily_rate),
            timeOutEdited: r.time_out_edited ?? false,
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
  salaryType: string;
  salaryRate: number;
  /** Days with something recorded. */
  recorded: number;
  /** Those days' dates (yyyy-MM-dd). */
  dates: string[];
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
      .select("id, full_name, position, is_active, salary_type, salary_rate")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("full_name"),
    supabase
      .from("attendance_logs")
      .select("employee_id, work_date, status, minutes_worked")
      .gte("work_date", cutoff.start)
      .lte("work_date", cutoff.end),
  ]);
  if (employees.error) throw employees.error;
  if (logs.error) throw logs.error;

  const byEmployee = new Map<
    string,
    { date: string; status: AttendanceLog["status"]; minutes: number }[]
  >();
  for (const l of logs.data) {
    if (!isDayStatus(l.status)) continue;
    const list = byEmployee.get(l.employee_id) ?? [];
    list.push({ date: l.work_date, status: l.status, minutes: l.minutes_worked ?? 0 });
    byEmployee.set(l.employee_id, list);
  }
  return employees.data.map((e) => {
    const days = byEmployee.get(e.id) ?? [];
    return {
      id: e.id,
      name: e.full_name,
      position: e.position,
      isActive: e.is_active,
      salaryType: e.salary_type,
      salaryRate: Number(e.salary_rate),
      recorded: days.length,
      dates: days.map((d) => d.date),
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

export type DayAttendanceRow = {
  id: string;
  name: string;
  position: string;
  category: string | null;
  salaryType: string;
  salaryRate: number;
  /** Pesos per overtime hour; null = overtime isn't paid. */
  overtimeRate: number | null;
  /** null = nothing recorded for the day. */
  log: AttendanceLog | null;
};

/**
 * Every active employee with their record for one day (the whole-team day
 * view). Same staff as the time record: active, not deleted.
 */
export async function getDayAttendance(date: string): Promise<DayAttendanceRow[]> {
  const supabase = await createClient();
  const [employees, logs] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, position, category, salary_type, salary_rate, overtime_rate")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("full_name"),
    supabase
      .from("attendance_logs")
      .select(
        "employee_id, work_date, status, time_in, time_out, minutes_worked, daily_rate, time_out_edited, note",
      )
      .eq("work_date", date),
  ]);
  if (employees.error) throw employees.error;
  if (logs.error) throw logs.error;

  const byEmployee = new Map<string, AttendanceLog>();
  for (const r of logs.data) {
    if (!isDayStatus(r.status)) continue;
    byEmployee.set(r.employee_id, {
      date: r.work_date,
      status: r.status,
      timeIn: r.time_in?.slice(0, 5) ?? null,
      timeOut: r.time_out?.slice(0, 5) ?? null,
      minutes: r.minutes_worked ?? 0,
      dailyRate: Number(r.daily_rate),
      timeOutEdited: r.time_out_edited ?? false,
      note: r.note,
    });
  }
  return employees.data.map((e) => ({
    id: e.id,
    name: e.full_name,
    position: e.position,
    category: e.category,
    salaryType: e.salary_type,
    salaryRate: Number(e.salary_rate),
    overtimeRate: e.overtime_rate === null ? null : Number(e.overtime_rate),
    log: byEmployee.get(e.id) ?? null,
  }));
}
