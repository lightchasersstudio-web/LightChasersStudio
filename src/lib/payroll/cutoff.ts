import { addDays, format, getDaysInMonth, parseISO } from "date-fns";

import { businessToday } from "@/lib/utils/business-date";

/** A semi-monthly cut-off: the 1st–15th or the 16th–last day of a month. */
export type Cutoff = {
  /** "2026-11-01" or "2026-11-16": also the cut-off's id in URLs. */
  start: string;
  end: string;
  half: 1 | 2;
};

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** The cut-off a "YYYY-MM-DD" date falls in. */
export function cutoffFor(date: string): Cutoff {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  if (day <= 15) return { start: iso(year, month, 1), end: iso(year, month, 15), half: 1 };
  const last = getDaysInMonth(new Date(year, month - 1, 1));
  return { start: iso(year, month, 16), end: iso(year, month, last), half: 2 };
}

/** The current cut-off in Manila. */
export const currentCutoff = (now: Date = new Date()): Cutoff => cutoffFor(businessToday(now));

/** A cut-off id from a URL ("2026-11-16"), or null if it isn't one. */
export function parseCutoff(value: unknown): Cutoff | null {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-(01|16)$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2100) return null;
  return cutoffFor(value);
}

export function shiftCutoff(c: Cutoff, delta: -1 | 1): Cutoff {
  return delta === 1
    ? cutoffFor(format(addDays(parseISO(c.end), 1), "yyyy-MM-dd"))
    : cutoffFor(format(addDays(parseISO(c.start), -1), "yyyy-MM-dd"));
}

/** Every date in the cut-off, in order. */
export function cutoffDates(c: Cutoff): string[] {
  const dates: string[] = [];
  for (let d = parseISO(c.start); format(d, "yyyy-MM-dd") <= c.end; d = addDays(d, 1)) {
    dates.push(format(d, "yyyy-MM-dd"));
  }
  return dates;
}

/** "Nov 1–15, 2026" */
export function cutoffLabel(c: Cutoff): string {
  const start = parseISO(c.start);
  return `${format(start, "MMM d")}–${format(parseISO(c.end), "d, yyyy")}`;
}

// ---------------------------------------------------------------------------
// Daily time record

export const DAY_STATUSES = [
  { value: "present", label: "Present" },
  { value: "am", label: "AM shift" },
  { value: "pm", label: "PM shift" },
  { value: "rest_day", label: "Rest day" },
  { value: "absent", label: "Absent" },
  { value: "leave", label: "Leave" },
  { value: "holiday", label: "Holiday" },
] as const;
export type DayStatus = (typeof DAY_STATUSES)[number]["value"];

export const isDayStatus = (v: unknown): v is DayStatus => DAY_STATUSES.some((s) => s.value === v);

export const dayStatusLabel = (status: DayStatus): string =>
  DAY_STATUSES.find((s) => s.value === status)?.label ?? status;

/** AM and PM: fixed 8-hour shifts paid as a full day. */
export const isShift = (status: string): status is "am" | "pm" =>
  status === "am" || status === "pm";

/** Days with a time in and out (and that count as worked). */
export const hasTimes = (status: string): status is "present" | "am" | "pm" =>
  status === "present" || isShift(status);

/**
 * Minutes between "HH:MM" times, as the database works it out: a time out
 * earlier than the time in means the shift ran past midnight.
 */
export function minutesWorked(timeIn: string, timeOut: string): number {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const diff = toMin(timeOut) - toMin(timeIn);
  return diff < 0 ? diff + 1440 : diff;
}

/** 510 → "8h 30m", 480 → "8h", 0 → "0h" */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}

export type DayTotals = Record<DayStatus, number> & { minutes: number };

/** Days worked: present plus AM and PM shifts. */
export const daysWorked = (t: DayTotals): number => t.present + t.am + t.pm;

export function dayTotals(days: { status: DayStatus; minutes: number }[]): DayTotals {
  const totals: DayTotals = {
    present: 0,
    am: 0,
    pm: 0,
    rest_day: 0,
    absent: 0,
    leave: 0,
    holiday: 0,
    minutes: 0,
  };
  for (const d of days) {
    totals[d.status] += 1;
    totals.minutes += d.minutes;
  }
  return totals;
}
