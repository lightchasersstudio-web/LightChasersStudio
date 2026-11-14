import "server-only";

import type { CheckInColumn, SecurityDeposit } from "@/lib/booking/check-in";
import { needsStudioPolicy } from "@/lib/booking/policy";
import type { BookingStatus } from "@/lib/booking/status";
import { createClient } from "@/lib/supabase/server";
import { businessDayRange } from "@/lib/utils/business-date";

/** Everything the shoot-day check-in card shows (Today page and booking page). */
export type CheckInBooking = {
  id: string;
  reference: string;
  status: BookingStatus;
  startAt: string;
  /** null = a package with a start time only. */
  endAt: string | null;
  contactName: string;
  contactPhone: string;
  serviceName: string;
  /** A studio session: the ID check and the inspections apply (policy 2.3, 2.5). */
  studio: boolean;
  participants: number;
  specialRequests: string | null;
  sensitiveShoot: boolean;
  btsOptOut: boolean;
  priceCents: number;
  paidCents: number;
  steps: Record<CheckInColumn, string | null>;
  deposit: SecurityDeposit;
  /** Settings → Extra charges: the security deposit suggested when collecting. */
  suggestedDepositCents: number;
};

/** The booking columns the card needs. */
export const CHECK_IN_COLUMNS =
  "id, reference_code, status, start_at, end_at, has_end_time, contact_name, contact_phone, participants, special_requests, sensitive_shoot, pets_or_messy, bts_opt_out, price_cents, id_checked_at, inspected_in_at, inspected_out_at, security_deposit_cents, security_deposit_method, security_deposit_collected_at, security_deposit_returned_cents, security_deposit_returned_at, security_deposit_note, service:services(name, booking_category), payments(amount_cents, status)";

type Row = {
  id: string;
  reference_code: string;
  status: BookingStatus;
  start_at: string;
  end_at: string;
  has_end_time: boolean;
  contact_name: string;
  contact_phone: string;
  participants: number;
  special_requests: string | null;
  sensitive_shoot: boolean;
  pets_or_messy: boolean;
  bts_opt_out: boolean;
  price_cents: number;
  id_checked_at: string | null;
  inspected_in_at: string | null;
  inspected_out_at: string | null;
  security_deposit_cents: number | null;
  security_deposit_method: string | null;
  security_deposit_collected_at: string | null;
  security_deposit_returned_cents: number | null;
  security_deposit_returned_at: string | null;
  security_deposit_note: string | null;
  service: { name: string; booking_category: string } | null;
  payments: { amount_cents: number; status: string }[];
};

export function toCheckIn(r: Row, suggestedDepositCents: number): CheckInBooking {
  return {
    id: r.id,
    reference: r.reference_code,
    status: r.status,
    startAt: r.start_at,
    endAt: r.has_end_time ? r.end_at : null,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    serviceName: r.service?.name ?? "Session",
    studio: needsStudioPolicy(r.service?.booking_category),
    participants: r.participants,
    specialRequests: r.special_requests,
    sensitiveShoot: r.sensitive_shoot,
    btsOptOut: r.bts_opt_out,
    priceCents: r.price_cents,
    paidCents: r.payments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amount_cents, 0),
    steps: {
      id_checked_at: r.id_checked_at,
      inspected_in_at: r.inspected_in_at,
      inspected_out_at: r.inspected_out_at,
    },
    deposit: {
      expected: r.pets_or_messy,
      collectedCents: r.security_deposit_cents,
      method: r.security_deposit_method,
      collectedAt: r.security_deposit_collected_at,
      returnedCents: r.security_deposit_returned_cents,
      returnedAt: r.security_deposit_returned_at,
      note: r.security_deposit_note,
    },
    suggestedDepositCents,
  };
}

/**
 * Bookings starting on one studio day that are going ahead or done (RLS:
 * admins only; callers check requireAdmin()), in time order.
 */
export async function listDayCheckIns(date: string): Promise<CheckInBooking[]> {
  const supabase = await createClient();
  const { from, to } = businessDayRange(date);
  const [bookings, settings] = await Promise.all([
    supabase
      .from("bookings")
      .select(CHECK_IN_COLUMNS)
      .gte("start_at", from)
      .lt("start_at", to)
      .in("status", ["pending", "confirmed", "completed"])
      .order("start_at"),
    supabase.from("business_settings").select("security_deposit_cents").single(),
  ]);
  if (bookings.error) throw bookings.error;
  if (settings.error) throw settings.error;
  return (bookings.data as unknown as Row[]).map((r) =>
    toCheckIn(r, settings.data.security_deposit_cents),
  );
}

/** One booking's shoot-day check-in (booking page). Null if it isn't found. */
export async function getCheckIn(id: string): Promise<CheckInBooking | null> {
  const supabase = await createClient();
  const [booking, settings] = await Promise.all([
    supabase.from("bookings").select(CHECK_IN_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("business_settings").select("security_deposit_cents").single(),
  ]);
  if (booking.error) throw booking.error;
  if (settings.error) throw settings.error;
  return booking.data
    ? toCheckIn(booking.data as unknown as Row, settings.data.security_deposit_cents)
    : null;
}
