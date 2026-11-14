import "server-only";

import { cutoffFor } from "@/lib/payroll/cutoff";
import { payrollDays, payrollYears, type DayTotal, type YearTotal } from "@/lib/payroll/history";
import { createClient } from "@/lib/supabase/server";

/**
 * Every saved payroll, added up by year and month (RLS: admins only; callers
 * check requireAdmin()). Payrolls are saved by themselves whenever days are
 * saved, so these are up to date.
 */
export async function getPayrollYears(): Promise<YearTotal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_periods")
    .select("period_start, payslips(net_pay, gross_pay, total_deductions)")
    .order("period_start");
  if (error) throw error;
  return payrollYears(data.map((p) => ({ start: p.period_start, payslips: p.payslips })));
}

/**
 * Each day's pay in a month ("YYYY-MM"), from the time record. Only staff with a
 * payslip in that day's cut-off count (deactivated staff keep their records but
 * aren't paid), so the days match the payslips.
 */
export async function getPayrollDays(month: string): Promise<DayTotal[]> {
  const supabase = await createClient();
  const [y, m] = month.split("-").map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const [logs, periods, settings] = await Promise.all([
    supabase
      .from("attendance_logs")
      .select(
        "employee_id, work_date, status, minutes_worked, daily_rate, employee:employees!inner(full_name, overtime_rate)",
      )
      .gte("work_date", `${month}-01`)
      .lt("work_date", next),
    supabase
      .from("payroll_periods")
      .select("period_start, payslips(employee_id)")
      .gte("period_start", `${month}-01`)
      .lt("period_start", next),
    supabase.from("contribution_settings").select("hours_per_day").single(),
  ]);
  if (logs.error) throw logs.error;
  if (periods.error) throw periods.error;
  if (settings.error) throw settings.error;
  // Who was paid in each cut-off of the month.
  const paid = new Set(
    periods.data.flatMap((p) => p.payslips.map((s) => `${p.period_start}|${s.employee_id}`)),
  );
  return payrollDays(
    logs.data
      .filter((l) => paid.has(`${cutoffFor(l.work_date).start}|${l.employee_id}`))
      .map((l) => ({
        date: l.work_date,
        name: l.employee.full_name,
        status: l.status,
        minutes: l.minutes_worked ?? 0,
        dailyRate: Number(l.daily_rate),
        overtimeRate: l.employee.overtime_rate === null ? null : Number(l.employee.overtime_rate),
      })),
    Math.round(Number(settings.data.hours_per_day) * 60),
  );
}
