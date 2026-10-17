import "server-only";

import { TZDate } from "@date-fns/tz";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, getDaysInMonth } from "date-fns";

import { monthSlots, type DaySlots } from "@/lib/booking/slots";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import type { Database } from "@/types/database.types";

/**
 * Bookable start times for every day of `month` ("YYYY-MM") for one package.
 * Uses whichever client the caller passes: the anon client for the public
 * wizard (active packages only, by RLS) or the admin's client (any package,
 * `staff` skips the notice period and booking window). `excludeBookingId`
 * (staff only, when moving a booking) leaves that booking's own time free.
 */
export async function loadMonthAvailability(
  supabase: SupabaseClient<Database>,
  serviceId: string,
  month: string,
  { staff = false, excludeBookingId }: { staff?: boolean; excludeBookingId?: string } = {},
): Promise<DaySlots[] | null> {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const first = new TZDate(year, monthIndex - 1, 1, BUSINESS_TZ);
  const lastDate = `${month}-${String(getDaysInMonth(first)).padStart(2, "0")}`;
  // A day of padding each side catches bookings that cross midnight.
  const from = addDays(first, -1).toISOString();
  const to = addDays(first, getDaysInMonth(first) + 1).toISOString();

  const [service, settings, hours, blackouts, busy] = await Promise.all([
    supabase.from("services").select("duration_minutes").eq("id", serviceId).maybeSingle(),
    supabase
      .from("business_settings")
      .select(
        "buffer_minutes, slot_interval_minutes, min_notice_hours, max_advance_days, max_concurrent_bookings",
      )
      .single(),
    supabase.from("availability_rules").select("day_of_week, start_time, end_time"),
    supabase.from("blackout_dates").select("date").gte("date", `${month}-01`).lte("date", lastDate),
    excludeBookingId
      ? busyExcluding(supabase, from, to, excludeBookingId)
      : supabase.rpc("get_busy_ranges", { p_from: from, p_to: to }),
  ]);
  for (const r of [service, settings, hours, blackouts, busy]) if (r.error) throw r.error;
  if (!service.data) return null;
  const s = settings.data!;

  return monthSlots({
    month,
    rules: {
      durationMinutes: service.data.duration_minutes,
      bufferMinutes: s.buffer_minutes,
      slotIntervalMinutes: s.slot_interval_minutes,
      minNoticeHours: s.min_notice_hours,
      maxAdvanceDays: s.max_advance_days,
      capacity: s.max_concurrent_bookings,
      ignoreWindow: staff,
    },
    hours: hours.data!.map((h) => ({
      day: h.day_of_week,
      start: h.start_time.slice(0, 5),
      end: h.end_time.slice(0, 5),
    })),
    blackouts: blackouts.data!.map((b) => b.date),
    busy: busy.data!.map((b) => ({ start: new Date(b.start_at), end: new Date(b.blocked_until) })),
    now: new Date(),
  });
}

/** Wire format for the calendar: ISO strings instead of Dates. */
export type MonthSlotsPayload = { date: string; status: DaySlots["status"]; slots: string[] }[];

export function toPayload(days: DaySlots[]): MonthSlotsPayload {
  return days.map((d) => ({
    date: d.date,
    status: d.status,
    slots: d.slots.map((s) => s.toISOString()),
  }));
}

/** Like get_busy_ranges, minus one booking (admin RLS can read bookings directly). */
async function busyExcluding(
  supabase: SupabaseClient<Database>,
  from: string,
  to: string,
  excludeId: string,
) {
  const { data, error } = await supabase
    .from("bookings")
    .select("start_at, blocked_until, status, hold_expires_at")
    .lt("start_at", to)
    .gt("blocked_until", from)
    .neq("id", excludeId)
    .in("status", ["pending_payment", "pending", "confirmed", "completed"]);
  const now = Date.now();
  return {
    error,
    data: (data ?? []).filter(
      (b) =>
        b.status !== "pending_payment" ||
        (b.hold_expires_at !== null && Date.parse(b.hold_expires_at) > now),
    ),
  };
}
