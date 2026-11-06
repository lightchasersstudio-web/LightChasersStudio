import { TZDate } from "@date-fns/tz";
import { addDays, addHours, addMinutes, getDaysInMonth } from "date-fns";

import { BUSINESS_TZ } from "@/lib/utils/business-date";

// Which start times can be booked on each day of a month. Mirrors the checks in
// create_booking()/admin_create_booking(); the database stays the final word.

export type SlotRules = {
  /** Time each booking holds before the buffer (see bookingLengthMinutes). */
  durationMinutes: number;
  bufferMinutes: number;
  slotIntervalMinutes: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
  /** Shoots that can run at the same time (business_settings.max_concurrent_bookings). */
  capacity: number;
  /** Staff bookings skip the notice period and the booking window. */
  ignoreWindow?: boolean;
};
/** Opening hours for one weekday (0 = Sunday), "HH:MM". */
export type WeeklyWindow = { day: number; start: string; end: string };
/** A booking's blocked time: start until end + buffer. */
export type BusyRange = { start: Date; end: Date };
export type DayStatus = "open" | "few" | "full" | "closed";
export type DaySlots = { date: string; slots: Date[]; status: DayStatus };

const FEW_LEFT = 2;

export function monthSlots({
  month,
  rules,
  hours,
  blackouts,
  busy,
  now,
}: {
  /** "YYYY-MM" in the business timezone. */
  month: string;
  rules: SlotRules;
  hours: WeeklyWindow[];
  /** "YYYY-MM-DD" */
  blackouts: string[];
  busy: BusyRange[];
  now: Date;
}): DaySlots[] {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const first = new TZDate(year, monthIndex - 1, 1, BUSINESS_TZ);
  // Staff skip the notice period, but never get offered a time that has already passed.
  const earliest = rules.ignoreWindow
    ? now.getTime()
    : addHours(now, rules.minNoticeHours).getTime();
  const latest = rules.ignoreWindow ? Infinity : addDays(now, rules.maxAdvanceDays).getTime();

  return Array.from({ length: getDaysInMonth(first) }, (_, i) => {
    const day = new TZDate(year, monthIndex - 1, i + 1, BUSINESS_TZ);
    const date = isoDate(day);
    const windows = blackouts.includes(date) ? [] : hours.filter((h) => h.day === day.getDay());

    const candidates = windows
      .flatMap((w) => startsInWindow(day, w, rules))
      .filter((start) => {
        const t = start.getTime();
        return t >= earliest && t <= latest;
      });
    const slots = candidates.filter((start) => {
      const blockedUntil = addMinutes(start, rules.durationMinutes + rules.bufferMinutes);
      return occupancyAt(busy, start, blockedUntil) < rules.capacity;
    });

    const status: DayStatus =
      candidates.length === 0
        ? "closed"
        : slots.length === 0
          ? "full"
          : slots.length <= FEW_LEFT
            ? "few"
            : "open";
    return { date, slots, status };
  });
}

/** Most bookings running at the same moment anywhere in [start, end). */
export function occupancyAt(busy: BusyRange[], start: Date, end: Date): number {
  const s = start.getTime();
  const e = end.getTime();
  const overlapping = busy.filter((b) => b.start.getTime() < e && b.end.getTime() > s);
  // The peak is reached at the range start or where another booking begins.
  const instants = [s, ...overlapping.map((b) => b.start.getTime()).filter((t) => t > s)];
  return Math.max(
    0,
    ...instants.map(
      (t) => overlapping.filter((b) => b.start.getTime() <= t && b.end.getTime() > t).length,
    ),
  );
}

/** Start times on the slot grid (from midnight) whose session fits inside the window. */
function startsInWindow(day: TZDate, window: WeeklyWindow, rules: SlotRules): Date[] {
  const open = minutes(window.start);
  const close = minutes(window.end);
  const step = rules.slotIntervalMinutes;
  const starts: Date[] = [];
  for (let m = Math.ceil(open / step) * step; m + rules.durationMinutes <= close; m += step) {
    const t = new TZDate(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      Math.floor(m / 60),
      m % 60,
      BUSINESS_TZ,
    );
    starts.push(new Date(t.getTime()));
  }
  return starts;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

function isoDate(d: TZDate): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
