import "server-only";

import { isDayStatus, type DayStatus } from "@/lib/payroll/cutoff";
import { computeDailyPay } from "@/lib/payroll/daily-pay";
import { toCents, toPesos } from "@/lib/payroll/money";
import { createClient } from "@/lib/supabase/server";

/** How many recent shifts the History card lists. */
export const HISTORY_SHIFT_LIMIT = 60;

export type HistoryPayment = {
  id: string;
  periodStart: string;
  periodEnd: string;
  savedAt: string;
  daysWorked: number;
  daysOff: number;
  gross: number;
  deductions: number;
  net: number;
};

export type HistoryShift = {
  date: string;
  status: DayStatus;
  timeIn: string | null;
  timeOut: string | null;
  timeOutEdited: boolean;
  minutes: number;
  dailyRate: number;
  /** Gross pay for the day (computeDailyPay). */
  pay: number;
  note: string | null;
};

export type EmployeeHistory = {
  payments: HistoryPayment[];
  /** Sum of every saved payslip's net pay. */
  totalNet: number;
  /** The latest shifts, newest first (up to HISTORY_SHIFT_LIMIT). */
  shifts: HistoryShift[];
  /** Every recorded day, for "showing x of y". */
  shiftCount: number;
};

/**
 * Saved payslips and recorded days for one employee, deleted or not (RLS:
 * admins only; callers check requireAdmin()). Shift pay uses the rate saved
 * with each day, like the daily payroll report.
 */
export async function getEmployeeHistory(
  employeeId: string,
  { overtimeRate, hoursPerDay }: { overtimeRate: number | null; hoursPerDay: number },
): Promise<EmployeeHistory> {
  const supabase = await createClient();
  const [slips, logs] = await Promise.all([
    supabase
      .from("payslips")
      .select(
        "id, days_present, days_absent, days_leave, days_holiday, gross_pay, total_deductions, net_pay, period:payroll_periods(period_start, period_end, saved_at)",
      )
      .eq("employee_id", employeeId),
    supabase
      .from("attendance_logs")
      .select(
        "work_date, status, time_in, time_out, time_out_edited, minutes_worked, daily_rate, note",
        { count: "exact" },
      )
      .eq("employee_id", employeeId)
      .order("work_date", { ascending: false })
      .limit(HISTORY_SHIFT_LIMIT),
  ]);
  if (slips.error) throw slips.error;
  if (logs.error) throw logs.error;

  const payments = slips.data
    .flatMap((p) =>
      p.period
        ? [
            {
              id: p.id,
              periodStart: p.period.period_start,
              periodEnd: p.period.period_end,
              savedAt: p.period.saved_at,
              daysWorked: p.days_present,
              daysOff: p.days_absent + p.days_leave + p.days_holiday,
              gross: Number(p.gross_pay),
              deductions: Number(p.total_deductions),
              net: Number(p.net_pay),
            },
          ]
        : [],
    )
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart));

  const shiftMinutes = Math.round(hoursPerDay * 60);
  const shifts = logs.data.flatMap((l) =>
    isDayStatus(l.status)
      ? [
          {
            date: l.work_date,
            status: l.status,
            timeIn: l.time_in?.slice(0, 5) ?? null,
            timeOut: l.time_out?.slice(0, 5) ?? null,
            timeOutEdited: l.time_out_edited ?? false,
            minutes: l.minutes_worked ?? 0,
            dailyRate: Number(l.daily_rate),
            pay: toPesos(
              computeDailyPay({
                status: l.status,
                minutes: l.minutes_worked ?? 0,
                dailyRate: Number(l.daily_rate),
                shiftMinutes,
                overtimeRate,
              }).payCents,
            ),
            note: l.note,
          },
        ]
      : [],
  );

  return {
    payments,
    totalNet: toPesos(payments.reduce((s, p) => s + toCents(p.net), 0)),
    shifts,
    shiftCount: logs.count ?? shifts.length,
  };
}
