import "server-only";

import { ratesFromRow } from "@/lib/payroll/contributions";
import { isDayStatus, type Cutoff, type DayStatus } from "@/lib/payroll/cutoff";
import { asSalaryType } from "@/lib/payroll/employees";
import { computePayslip, type Payslip } from "@/lib/payroll/payslip";
import { createClient } from "@/lib/supabase/server";

/**
 * Fresh payslips for every active employee from today's salaries, benefits,
 * rates and the cut-off's time record. Callers check requireAdmin().
 */
export async function computePayroll(cutoff: Cutoff): Promise<Payslip[]> {
  const supabase = await createClient();
  const [employees, logs, settings] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, full_name, position, salary_type, salary_rate, overtime_rate, benefits:employee_benefits(*)",
      )
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("attendance_logs")
      .select("employee_id, status, minutes_worked")
      .gte("work_date", cutoff.start)
      .lte("work_date", cutoff.end),
    supabase.from("contribution_settings").select("*").single(),
  ]);
  if (employees.error) throw employees.error;
  if (logs.error) throw logs.error;
  if (settings.error) throw settings.error;

  const rates = ratesFromRow(settings.data);
  const days = new Map<string, { status: DayStatus; minutes: number }[]>();
  for (const l of logs.data) {
    if (!isDayStatus(l.status)) continue;
    const list = days.get(l.employee_id) ?? [];
    list.push({ status: l.status, minutes: l.minutes_worked ?? 0 });
    days.set(l.employee_id, list);
  }

  return employees.data.map((e) =>
    computePayslip({
      employee: {
        id: e.id,
        name: e.full_name,
        position: e.position,
        salaryType: asSalaryType(e.salary_type),
        salaryRate: Number(e.salary_rate),
        overtimeRate: e.overtime_rate === null ? null : Number(e.overtime_rate),
      },
      benefits: {
        sss: e.benefits?.sss_enabled ?? true,
        philhealth: e.benefits?.philhealth_enabled ?? true,
        pagibig: e.benefits?.pagibig_enabled ?? true,
      },
      days: days.get(e.id) ?? [],
      rates,
      half: cutoff.half,
    }),
  );
}

export type SavedPayroll = {
  id: string;
  savedAt: string;
  savedBy: string | null;
  payslips: (Payslip & { id: string })[];
};

const num = (v: number | string) => Number(v);
const numOrNull = (v: number | string | null) => (v === null ? null : Number(v));

/** The payroll saved for a cut-off, with its payslips A–Z. */
export async function getSavedPayroll(cutoff: Cutoff): Promise<SavedPayroll | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_periods")
    .select("id, saved_at, saved_by, payslips(*)")
    .eq("period_start", cutoff.start)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let savedBy: string | null = null;
  if (data.saved_by) {
    const { data: profile } = await supabase
      .from("admin_profiles")
      .select("full_name")
      .eq("user_id", data.saved_by)
      .maybeSingle();
    savedBy = profile?.full_name ?? null;
  }

  return {
    id: data.id,
    savedAt: data.saved_at,
    savedBy,
    payslips: data.payslips
      .map((p) => ({
        id: p.id,
        employee_id: p.employee_id,
        employee_name: p.employee_name,
        employee_position: p.employee_position,
        salary_type: asSalaryType(p.salary_type),
        salary_rate: num(p.salary_rate),
        daily_rate: num(p.daily_rate),
        monthly_salary: num(p.monthly_salary),
        hourly_rate: num(p.hourly_rate),
        overtime_rate: numOrNull(p.overtime_rate),
        days_present: p.days_present,
        days_absent: p.days_absent,
        days_leave: p.days_leave,
        days_holiday: p.days_holiday,
        minutes_worked: p.minutes_worked,
        regular_minutes: p.regular_minutes,
        undertime_minutes: p.undertime_minutes,
        overtime_minutes: p.overtime_minutes,
        basic_pay: num(p.basic_pay),
        overtime_pay: num(p.overtime_pay),
        absence_deduction: num(p.absence_deduction),
        undertime_deduction: num(p.undertime_deduction),
        sss_deduction: numOrNull(p.sss_deduction),
        philhealth_deduction: numOrNull(p.philhealth_deduction),
        pagibig_deduction: numOrNull(p.pagibig_deduction),
        gross_pay: num(p.gross_pay),
        total_deductions: num(p.total_deductions),
        net_pay: num(p.net_pay),
      }))
      .sort((a, b) => a.employee_name.localeCompare(b.employee_name)),
  };
}

/** Recently saved payrolls, newest cut-off first. */
export async function listSavedPayrolls(limit = 6) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_periods")
    .select("period_start, period_end, saved_at, payslips(net_pay)")
    .order("period_start", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((p) => ({
    start: p.period_start,
    end: p.period_end,
    savedAt: p.saved_at,
    count: p.payslips.length,
    net: p.payslips.reduce((s, x) => s + Math.round(Number(x.net_pay) * 100), 0) / 100,
  }));
}
