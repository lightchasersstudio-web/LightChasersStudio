import "server-only";

import { TZDate } from "@date-fns/tz";
import { addDays, getDaysInMonth } from "date-fns";

import type { BookingStatus } from "@/lib/booking/status";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS_TZ } from "@/lib/utils/business-date";

export type CalendarBooking = {
  id: string;
  reference: string;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  blockedUntil: string;
  contactName: string;
  serviceName: string;
  needsRefundReview: boolean;
  source: string;
};

/** Bookings touching `month` ("YYYY-MM"), for the admin calendar (RLS: admins only). */
export async function listBookingsForMonth(
  month: string,
  { includeClosed = false } = {},
): Promise<CalendarBooking[]> {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new TZDate(y, m - 1, 1, BUSINESS_TZ);
  const from = addDays(first, -1).toISOString();
  const to = addDays(first, getDaysInMonth(first) + 1).toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, reference_code, status, start_at, end_at, blocked_until, hold_expires_at, contact_name, needs_refund_review, source, service:services(name)",
    )
    .lt("start_at", to)
    .gt("blocked_until", from)
    .order("start_at");
  if (error) throw error;

  const now = Date.now();
  return data
    .map((b) => ({
      ...b,
      // A lapsed hold is effectively expired even before the cron job marks it.
      status:
        b.status === "pending_payment" && b.hold_expires_at && Date.parse(b.hold_expires_at) <= now
          ? ("expired" as const)
          : b.status,
    }))
    .filter((b) => includeClosed || !["cancelled", "declined", "expired"].includes(b.status))
    .map((b) => ({
      id: b.id,
      reference: b.reference_code,
      status: b.status,
      startAt: b.start_at,
      endAt: b.end_at,
      blockedUntil: b.blocked_until,
      contactName: b.contact_name,
      serviceName: b.service?.name ?? "Session",
      needsRefundReview: b.needs_refund_review,
      source: b.source,
    }));
}

export type CalendarContext = {
  hours: { day: number; start: string; end: string }[];
  blackouts: { date: string; reason: string | null }[];
  capacity: number;
  slotInterval: number;
};

/** Opening hours, blocked dates and capacity for drawing the calendar. */
export async function getCalendarContext(month: string): Promise<CalendarContext> {
  const supabase = await createClient();
  const [hours, blackouts, settings] = await Promise.all([
    supabase.from("availability_rules").select("day_of_week, start_time, end_time"),
    supabase
      .from("blackout_dates")
      .select("date, reason")
      .gte("date", `${month}-01`)
      .lt("date", nextMonthStart(month)),
    supabase
      .from("business_settings")
      .select("max_concurrent_bookings, slot_interval_minutes")
      .single(),
  ]);
  for (const r of [hours, blackouts, settings]) if (r.error) throw r.error;
  return {
    hours: hours.data!.map((h) => ({
      day: h.day_of_week,
      start: h.start_time.slice(0, 5),
      end: h.end_time.slice(0, 5),
    })),
    blackouts: blackouts.data!,
    capacity: settings.data!.max_concurrent_bookings,
    slotInterval: settings.data!.slot_interval_minutes,
  };
}

/** "2026-12" → "2027-01-01" */
function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export type AdminBooking = Awaited<ReturnType<typeof getBookingForAdmin>>;

/** One booking with client, payments and the booking-card summary (RLS: admins only). */
export async function getBookingForAdmin(id: string) {
  const supabase = await createClient();
  const [{ data, error }, settings] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, reference_code, status, source, service_id, start_at, end_at, has_end_time, contact_name, contact_phone, preferred_contact, messenger, location, participants, special_requests, admin_notes, price_cents, vat_cents, deposit_cents, hold_expires_at, needs_refund_review, created_at, service:services(name, category), add_ons:booking_add_ons(add_on_id, name, price_cents), client:clients(email), payments(id, provider, amount_cents, status, paid_at, reference, created_at)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("business_settings").select("business_name, phone, email, vat_percent").single(),
  ]);
  if (error) throw error;
  if (settings.error) throw settings.error;
  if (!data) return null;

  const payments = [...data.payments].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const paidCents = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount_cents, 0);
  return {
    ...data,
    email: data.client?.email ?? null,
    serviceName: data.service?.name ?? "Session",
    vatPercent: settings.data.vat_percent,
    payments,
    paidCents,
    summary: {
      reference: data.reference_code,
      serviceName: data.service?.name ?? "Session",
      addOns: data.add_ons.map((a) => ({ name: a.name, priceCents: a.price_cents })),
      startAt: data.start_at,
      endAt: data.has_end_time ? data.end_at : null,
      location: data.location,
      priceCents: data.price_cents,
      vatCents: data.vat_cents,
      paidCents,
      contactName: data.contact_name,
      studioName: settings.data.business_name,
      studioPhone: settings.data.phone,
      studioEmail: settings.data.email,
    },
  };
}

export type DashboardBooking = {
  id: string;
  reference: string;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  contactName: string;
  serviceName: string;
  needsRefundReview: boolean;
};

export type Dashboard = {
  todayCount: number;
  weekCount: number;
  needsReviewCount: number;
  refundReviewCount: number;
  /** The next shoots (today onwards, up to two weeks), soonest first. */
  upcoming: DashboardBooking[];
  /** Paid requests waiting for a yes/no, and late payments to check. */
  attention: DashboardBooking[];
};

const DASHBOARD_FIELDS =
  "id, reference_code, status, start_at, end_at, contact_name, needs_refund_review, hold_expires_at, service:services(name)";

/** Counts and short lists for the admin home page (RLS: admins only). */
export async function getDashboard(now: Date = new Date()): Promise<Dashboard> {
  const today = new TZDate(now, BUSINESS_TZ);
  const dayStart = new TZDate(today.getFullYear(), today.getMonth(), today.getDate(), BUSINESS_TZ);
  const iso = (days: number) => addDays(dayStart, days).toISOString();

  const supabase = await createClient();
  const [upcoming, attention] = await Promise.all([
    supabase
      .from("bookings")
      .select(DASHBOARD_FIELDS)
      .in("status", ["pending_payment", "pending", "confirmed"])
      .gte("end_at", iso(0))
      .lt("start_at", iso(14))
      .order("start_at")
      .limit(50),
    supabase
      .from("bookings")
      .select(DASHBOARD_FIELDS)
      .or("status.eq.pending,needs_refund_review.eq.true")
      .not("status", "in", "(cancelled,declined,expired,completed)")
      .order("start_at")
      .limit(50),
  ]);
  if (upcoming.error) throw upcoming.error;
  if (attention.error) throw attention.error;

  type Row = (typeof upcoming.data)[number];
  const live = (b: Row) =>
    // A lapsed hold no longer holds the slot, even before the cron job marks it.
    !(
      b.status === "pending_payment" &&
      b.hold_expires_at &&
      Date.parse(b.hold_expires_at) <= now.getTime()
    );
  const toItem = (b: Row): DashboardBooking => ({
    id: b.id,
    reference: b.reference_code,
    status: b.status,
    startAt: b.start_at,
    endAt: b.end_at,
    contactName: b.contact_name,
    serviceName: b.service?.name ?? "Session",
    needsRefundReview: b.needs_refund_review,
  });

  const shoots = upcoming.data.filter(live).map(toItem);
  const before = (days: number) =>
    shoots.filter((b) => Date.parse(b.startAt) < Date.parse(iso(days))).length;
  const needs = attention.data.map(toItem);
  return {
    todayCount: before(1),
    weekCount: before(7),
    needsReviewCount: needs.filter((b) => b.status === "pending").length,
    refundReviewCount: needs.filter((b) => b.needsRefundReview).length,
    upcoming: shoots.slice(0, 8),
    attention: needs.slice(0, 6),
  };
}

export type HistoryEntry = {
  id: number;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: string;
};

/** Who changed this booking and when, newest first (audit_logs; RLS: admins only). */
export async function listBookingHistory(bookingId: string): Promise<HistoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, metadata, created_at, actor_id")
    .eq("entity", "booking")
    .eq("entity_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const actorIds = [...new Set(data.map((r) => r.actor_id).filter((id): id is string => !!id))];
  const { data: admins } = actorIds.length
    ? await supabase.from("admin_profiles").select("user_id, full_name").in("user_id", actorIds)
    : { data: [] };
  const names = new Map((admins ?? []).map((a) => [a.user_id, a.full_name]));
  return data.map((r) => ({
    id: r.id,
    action: r.action,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
    actor: (r.actor_id && names.get(r.actor_id)) || "Staff",
  }));
}
