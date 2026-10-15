import "server-only";

import { TZDate } from "@date-fns/tz";
import { addDays, endOfMonth, startOfMonth } from "date-fns";

import type { BookingStatus } from "@/lib/booking/status";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS_TZ } from "@/lib/utils/business-date";

export type DashboardBooking = {
  id: string;
  reference: string;
  status: BookingStatus;
  startAt: string;
  contactName: string;
  serviceName: string;
  needsRefundReview: boolean;
  holdExpiresAt: string | null;
};

export type Dashboard = {
  needsReview: DashboardBooking[];
  today: DashboardBooking[];
  upcoming: DashboardBooking[];
  awaitingPayment: DashboardBooking[];
  stats: { bookingsThisMonth: number; collectedThisMonthCents: number };
};

/** What the studio needs to act on now, plus this month's totals (RLS: admins only). */
export async function getDashboard(now = new Date()): Promise<Dashboard> {
  const supabase = await createClient();
  const local = new TZDate(now, BUSINESS_TZ);
  const todayStart = new TZDate(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
    BUSINESS_TZ,
  );
  const tomorrow = addDays(todayStart, 1);
  const weekEnd = addDays(todayStart, 8);
  const monthStart = startOfMonth(local);
  const monthEnd = endOfMonth(local);

  const [active, monthBookings, payments] = await Promise.all([
    // Everything from today on that still holds a place, plus any flagged booking.
    supabase
      .from("bookings")
      .select(
        "id, reference_code, status, start_at, contact_name, needs_refund_review, hold_expires_at, service:services(name)",
      )
      .or(
        `and(start_at.gte.${todayStart.toISOString()},status.in.(pending_payment,pending,confirmed)),needs_refund_review.eq.true`,
      )
      .order("start_at")
      .limit(200),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("start_at", monthStart.toISOString())
      .lte("start_at", monthEnd.toISOString())
      .in("status", ["pending", "confirmed", "completed"]),
    supabase
      .from("payments")
      .select("amount_cents")
      .eq("status", "paid")
      .gte("paid_at", monthStart.toISOString())
      .lte("paid_at", monthEnd.toISOString()),
  ]);
  for (const r of [active, monthBookings, payments]) if (r.error) throw r.error;

  const rows: DashboardBooking[] = active.data!.map((b) => ({
    id: b.id,
    reference: b.reference_code,
    status: b.status,
    startAt: b.start_at,
    contactName: b.contact_name,
    serviceName: b.service?.name ?? "Session",
    needsRefundReview: b.needs_refund_review,
    holdExpiresAt: b.hold_expires_at,
  }));
  const at = (b: DashboardBooking) => Date.parse(b.startAt);
  const held = (b: DashboardBooking) =>
    b.status === "pending_payment" &&
    !!b.holdExpiresAt &&
    Date.parse(b.holdExpiresAt) > now.getTime();

  return {
    needsReview: rows.filter((b) => b.status === "pending" || b.needsRefundReview),
    today: rows.filter(
      (b) =>
        at(b) >= todayStart.getTime() &&
        at(b) < tomorrow.getTime() &&
        (b.status === "confirmed" || b.status === "pending"),
    ),
    upcoming: rows.filter(
      (b) => b.status === "confirmed" && at(b) >= tomorrow.getTime() && at(b) < weekEnd.getTime(),
    ),
    awaitingPayment: rows.filter(held),
    stats: {
      bookingsThisMonth: monthBookings.count ?? 0,
      collectedThisMonthCents: payments.data!.reduce((sum, p) => sum + p.amount_cents, 0),
    },
  };
}
