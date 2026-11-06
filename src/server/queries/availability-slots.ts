import "server-only";

import { TZDate } from "@date-fns/tz";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, getDaysInMonth } from "date-fns";

import { addOnOffered, bookingLengthMinutes } from "@/lib/booking/package-length";
import { monthSlots, type BusyRange, type DaySlots } from "@/lib/booking/slots";
import { asBookingCategory } from "@/lib/catalog";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import type { Database } from "@/types/database.types";

/**
 * Bookable start times for every day of `month` ("YYYY-MM") for one package.
 * Uses whichever client the caller passes: the anon client for the public
 * wizard (active packages only, by RLS) or the admin's client (any package,
 * `staff` skips the notice period and booking window). `excludeBookingId`
 * (staff only, when moving a booking) leaves that booking's own time free.
 * `addOnIds` lengthens a package with a set length by its time-adding add-ons
 * (e.g. a photobooth extension); other packages just need their start slot.
 * What blocks a time depends on the package's booking category (mirrors
 * assert_schedule): a studio package is blocked by studio bookings (and, for
 * clients, the workshop's hours); an outside event by any day that already has
 * one; a package with no scheduling rules by nothing.
 */
export async function loadMonthAvailability(
  supabase: SupabaseClient<Database>,
  serviceId: string,
  month: string,
  {
    staff = false,
    excludeBookingId,
    addOnIds = [],
  }: { staff?: boolean; excludeBookingId?: string; addOnIds?: string[] } = {},
): Promise<DaySlots[] | null> {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const first = new TZDate(year, monthIndex - 1, 1, BUSINESS_TZ);
  const lastDate = `${month}-${String(getDaysInMonth(first)).padStart(2, "0")}`;
  // A day of padding each side catches bookings that cross midnight.
  const from = addDays(first, -1).toISOString();
  const to = addDays(first, getDaysInMonth(first) + 1).toISOString();

  const [service, settings, hours, blackouts, busy, addOns, outsideDays] = await Promise.all([
    supabase
      .from("services")
      .select("duration_minutes, booking_category")
      .eq("id", serviceId)
      .maybeSingle(),
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
    addOnIds.length
      ? supabase.from("add_ons").select("extra_minutes, service_ids").in("id", addOnIds)
      : { data: [], error: null },
    supabase.rpc("get_outside_days", {
      p_from: `${month}-01`,
      p_to: lastDate,
      ...(excludeBookingId ? { p_exclude: excludeBookingId } : {}),
    }),
  ]);
  for (const r of [service, settings, hours, blackouts, busy, addOns, outsideDays])
    if (r.error) throw r.error;
  if (!service.data) return null;
  const s = settings.data!;
  const category = asBookingCategory(service.data.booking_category);
  const studioBusy: BusyRange[] =
    category === "studio"
      ? busy.data!.map((b) => ({ start: new Date(b.start_at), end: new Date(b.blocked_until) }))
      : [];
  // Staff may put any add-on on a booking; the public only those offered with it.
  const extraMinutes = addOns
    .data!.filter((a) => staff || addOnOffered(a, serviceId))
    .reduce((sum, a) => sum + a.extra_minutes, 0);

  return monthSlots({
    month,
    rules: {
      durationMinutes: bookingLengthMinutes(
        service.data.duration_minutes,
        extraMinutes,
        s.slot_interval_minutes,
      ),
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
    busy: studioBusy,
    fullDays: category === "outside" ? (outsideDays.data ?? []) : [],
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

/**
 * Like get_busy_ranges (studio bookings only), minus one booking and without
 * the workshop's hours: staff may move a booking into them. Admin RLS can read
 * bookings directly.
 */
async function busyExcluding(
  supabase: SupabaseClient<Database>,
  from: string,
  to: string,
  excludeId: string,
) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "start_at, blocked_until, status, hold_expires_at, service:services!inner(booking_category)",
    )
    .eq("service.booking_category", "studio")
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
