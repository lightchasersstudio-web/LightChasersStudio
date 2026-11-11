import { isShift, type DayStatus, type ShiftStatus } from "@/lib/payroll/cutoff";
import { toCents } from "@/lib/payroll/money";

// One day's pay, the single place the per-day rules live (owner request
// 2026-11-10). Used by the daily payroll report and by daily-paid payslips.

/**
 * The fixed shifts (owner decisions 2026-11-10): picking one fills these times
 * (the admin can change them). AM 9:30 AM–5:30 PM, PM 2:00 PM–10:00 PM,
 * AM/PM 9:30 AM–10:00 PM for staff who work both.
 */
export const SHIFTS: Record<ShiftStatus, { start: string; minutes: number }> = {
  am: { start: "09:30", minutes: 8 * 60 },
  pm: { start: "14:00", minutes: 8 * 60 },
  am_pm: { start: "09:30", minutes: 12 * 60 + 30 },
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * "HH:MM" + the shift's length (AM/PM 8 hours, AM/PM both 12½), wrapping past
 * midnight ("20:00" + 8 h → "04:00", the next day). Null when the time isn't valid.
 */
export function shiftTimeOut(timeIn: string, shift: ShiftStatus = "am"): string | null {
  const m = HHMM.exec(timeIn);
  if (!m) return null;
  const minutes = (Number(m[1]) * 60 + Number(m[2]) + SHIFTS[shift].minutes) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** A shift's time out that isn't time in + its length (matches the DB's time_out_edited). */
export function isTimeOutEdited(status: string, timeIn: string, timeOut: string): boolean {
  if (!isShift(status) || timeOut === "") return false;
  const expected = shiftTimeOut(timeIn, status);
  return expected !== null && expected !== timeOut;
}

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
 * - AM, PM or AM/PM shift: the day's rate, however long the day ran (AM/PM
 *   starts at the AM/PM rate from Payroll settings, ₱650).
 * - Present (unchanged rule): the daily rate, less the time short of a
 *   regular day at the hourly rate, plus time past it at the overtime rate.
 * - Rest day, absent, leave, holiday: nothing.
 */
export function computeDailyPay(d: DayPayInput): DayPay {
  const rateCents = toCents(d.dailyRate);
  if (isShift(d.status)) {
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
