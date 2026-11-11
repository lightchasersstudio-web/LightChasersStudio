import { hasTimes, isShift } from "@/lib/payroll/cutoff";
import { SHIFTS, shiftTimeOut } from "@/lib/payroll/daily-pay";

/** One day's fields as typed in the time record (strings, "" = blank). */
export type DayEntryFields = { status: string; timeIn: string; timeOut: string; rate: string };

/**
 * What changes when a day's status is picked, shared by the per-person sheet
 * and the whole-team day view:
 * - a shift (AM, PM, AM/PM) always fills its usual times;
 * - a status without times (absent, rest day…) clears them;
 * - AM/PM puts in the AM/PM rate; leaving it puts the employee's own rate back,
 *   unless the rate was changed by hand. A blank rate gets the employee's rate.
 */
export function afterStatusChange(
  day: DayEntryFields,
  next: string,
  rates: { current: string; amPm: string },
): DayEntryFields {
  let { timeIn, timeOut, rate } = day;
  if (isShift(next)) {
    timeIn = SHIFTS[next].start;
    timeOut = shiftTimeOut(timeIn, next) ?? "";
  } else if (!hasTimes(next)) {
    timeIn = "";
    timeOut = "";
  }
  const typed = rate.trim();
  if (next === "am_pm") {
    rate = rates.amPm;
  } else if (next && (typed === "" || (day.status === "am_pm" && typed === rates.amPm))) {
    rate = rates.current;
  }
  return { status: next, timeIn, timeOut, rate };
}

/** A new time in on a shift moves its time out with it; null = leave the time out. */
export function timeOutForNewTimeIn(status: string, timeIn: string): string | null {
  return isShift(status) ? shiftTimeOut(timeIn, status) : null;
}
