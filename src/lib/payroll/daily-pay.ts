import type { DayStatus } from "@/lib/payroll/cutoff";
import { toCents } from "@/lib/payroll/money";

// One day's pay, the single place the per-day rules live (owner request
// 2026-11-10). Used by the daily payroll report and by daily-paid payslips.

/** AM and PM shifts are always 8 hours. */
export const SHIFT_HOURS = 8;

/**
 * Suggested time in when AM or PM is picked (the admin can change it), owner
 * decision 2026-11-10: AM 9:30 AM–5:30 PM, PM 2:00 PM–10:00 PM.
 */
export const SHIFT_START: Record<"am" | "pm", string> = { am: "09:30", pm: "14:00" };

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * "HH:MM" + 8 hours, wrapping past midnight ("20:00" → "04:00", the next day).
 * Null when the time isn't valid.
 */
export function shiftTimeOut(timeIn: string): string | null {
  const m = HHMM.exec(timeIn);
  if (!m) return null;
  const minutes = (Number(m[1]) * 60 + Number(m[2]) + SHIFT_HOURS * 60) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** An AM/PM time out that isn't time in + 8 hours (matches the DB's time_out_edited). */
export const isTimeOutEdited = (status: string, timeIn: string, timeOut: string): boolean =>
  (status === "am" || status === "pm") &&
  shiftTimeOut(timeIn) !== null &&
  timeOut !== "" &&
  shiftTimeOut(timeIn) !== timeOut;

export type DayPayInput = {
  status: DayStatus;
  /** Time between time in and time out. */
  minutes: number;
  /** Pesos for the day (the record's own rate). */
  dailyRate: number;
  /** A regular day in minutes (Payroll settings → hours per day), for present days. */
  shiftMinutes: number;
  /** Pesos per overtime hour; null = overtime isn't paid. */
  overtimeRate: number | null;
};

/** Centavos and minutes for one day. pay = basic − undertime + overtime. */
export type DayPay = {
  basicCents: number;
  undertimeCents: number;
  overtimeCents: number;
  payCents: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
};

const NOTHING: DayPay = {
  basicCents: 0,
  undertimeCents: 0,
  overtimeCents: 0,
  payCents: 0,
  undertimeMinutes: 0,
  overtimeMinutes: 0,
};

/**
 * - AM / PM shift: the full daily rate, however long the day ran.
 * - Present (unchanged rule): the daily rate, less the time short of a
 *   regular day at the hourly rate, plus time past it at the overtime rate.
 * - Rest day, absent, leave, holiday: nothing.
 */
export function computeDailyPay(d: DayPayInput): DayPay {
  const rateCents = toCents(d.dailyRate);
  if (d.status === "am" || d.status === "pm") {
    return { ...NOTHING, basicCents: rateCents, payCents: rateCents };
  }
  if (d.status !== "present") return NOTHING;

  const shift = Math.max(1, d.shiftMinutes);
  const undertimeMinutes = Math.max(0, shift - d.minutes);
  const overtimeMinutes = Math.max(0, d.minutes - shift);
  const undertimeCents = Math.min(rateCents, Math.round((rateCents * undertimeMinutes) / shift));
  const overtimeCents =
    d.overtimeRate === null ? 0 : Math.round((toCents(d.overtimeRate) * overtimeMinutes) / 60);
  return {
    basicCents: rateCents,
    undertimeCents,
    overtimeCents,
    payCents: rateCents - undertimeCents + overtimeCents,
    undertimeMinutes,
    overtimeMinutes,
  };
}
