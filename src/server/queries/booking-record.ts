import "server-only";

import { summaryDays, summaryPeople, type BookingSummary } from "@/lib/booking/booking-summary";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingStatus } from "@/lib/booking/status";

export type { BookingStatus };

/** A booking with what emails, the booking card and the lookup page need. */
export type BookingRecord = {
  id: string;
  status: BookingStatus;
  email: string | null;
  holdExpiresAt: string | null;
  depositCents: number;
  needsRefundReview: boolean;
  summary: BookingSummary;
  /** The package contract the client agreed to when booking online (null = none). */
  contract: { text: string; acceptedAt: string } | null;
};

/**
 * Loads one booking with the SERVICE ROLE (bypasses RLS). Callers must already
 * have checked access: an admin, the verified webhook, or a reference + email match.
 */
export async function loadBookingRecord(
  where: { id: string } | { reference: string },
): Promise<BookingRecord | null> {
  const supabase = createAdminClient();
  const query = supabase
    .from("bookings")
    .select(
      "id, reference_code, status, start_at, end_at, has_end_time, contract_text, contract_accepted_at, location, price_cents, vat_cents, deposit_cents, hold_expires_at, needs_refund_review, contact_name, service:services(name, category, workshop_days), add_ons:booking_add_ons(name, price_cents), attendees:booking_attendees(position, full_name, category, price_cents), client:clients(email), payments(amount_cents, status)",
    );
  const [{ data, error }, settings] = await Promise.all([
    "id" in where
      ? query.eq("id", where.id).maybeSingle()
      : query.eq("reference_code", where.reference).maybeSingle(),
    supabase.from("business_settings").select("business_name, phone, email").single(),
  ]);
  if (error) throw error;
  if (settings.error) throw settings.error;
  if (!data) return null;

  const paidCents = data.payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount_cents, 0);
  return {
    id: data.id,
    status: data.status,
    email: data.client?.email ?? null,
    holdExpiresAt: data.hold_expires_at,
    depositCents: data.deposit_cents,
    needsRefundReview: data.needs_refund_review,
    contract:
      data.contract_text && data.contract_accepted_at
        ? { text: data.contract_text, acceptedAt: data.contract_accepted_at }
        : null,
    summary: {
      reference: data.reference_code,
      serviceName: data.service?.name ?? "Photo session",
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
      people: summaryPeople(data.attendees),
      days: summaryDays(data.service),
    },
  };
}

/**
 * The bookings made with this email, newest shoot first, for the "email me my
 * bookings" reminder (SERVICE ROLE: only ever mailed to that same address).
 * Lapsed payment holds are left out.
 */
export async function listBookingsForEmail(email: string, limit = 10) {
  const supabase = createAdminClient();
  const [{ data, error }, settings] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "reference_code, status, start_at, end_at, has_end_time, service:services(name), client:clients!inner(email)",
      )
      .eq("client.email", email.trim().toLowerCase())
      .neq("status", "expired")
      .order("start_at", { ascending: false })
      .limit(limit),
    supabase.from("business_settings").select("business_name, phone, email").single(),
  ]);
  if (error) throw error;
  if (settings.error) throw settings.error;
  return {
    studio: {
      name: settings.data.business_name,
      phone: settings.data.phone,
      email: settings.data.email,
    },
    bookings: data.map((b) => ({
      reference: b.reference_code,
      status: b.status,
      serviceName: b.service?.name ?? "Photo session",
      startAt: b.start_at,
      endAt: b.has_end_time ? b.end_at : null,
    })),
  };
}

/**
 * Confirmed bookings starting in [from, to) that haven't had their reminder yet
 * and have an email to send it to (SERVICE ROLE: the cron route only).
 */
export async function listRemindersDue(range: { from: string; to: string }) {
  const { data, error } = await createAdminClient()
    .from("bookings")
    .select("id, client:clients!inner(email)")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .not("client.email", "is", null)
    .gte("start_at", range.from)
    .lt("start_at", range.to)
    .order("start_at")
    .limit(200);
  if (error) throw error;
  return data.map((b) => b.id);
}

/**
 * Marks one booking's reminder as sent, only if nobody else did (two overlapping
 * runs can't both email). Returns whether this caller got it.
 */
export async function claimReminder(bookingId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("bookings")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", bookingId)
    .is("reminder_sent_at", null)
    .select("id");
  if (error) throw error;
  return data.length > 0;
}
