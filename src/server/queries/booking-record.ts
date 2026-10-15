import "server-only";

import type { BookingSummary } from "@/lib/booking/booking-summary";
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
      "id, reference_code, status, start_at, end_at, location, price_cents, deposit_cents, hold_expires_at, needs_refund_review, contact_name, service:services(name), client:clients(email), payments(amount_cents, status)",
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
    summary: {
      reference: data.reference_code,
      serviceName: data.service?.name ?? "Photo session",
      startAt: data.start_at,
      endAt: data.end_at,
      location: data.location,
      priceCents: data.price_cents,
      paidCents,
      contactName: data.contact_name,
      studioName: settings.data.business_name,
      studioPhone: settings.data.phone,
      studioEmail: settings.data.email,
    },
  };
}
