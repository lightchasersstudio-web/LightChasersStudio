"use server";

import { BOOKING_ERRORS, bookingErrorCode } from "@/lib/booking/booking-errors";
import type { BookingSummary } from "@/lib/booking/booking-summary";
import { bookingTotals } from "@/lib/booking/pricing";
import { attendeesCents, workshopPrices } from "@/lib/booking/workshop";
import { getPublicEnv } from "@/lib/env";
import { createCheckoutSession, paymongoConfigured } from "@/lib/payments/paymongo";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import { CONSENT_VERSION, lookupSchema, publicBookingSchema } from "@/lib/validations/booking";
import { notifyBookingReceived } from "@/server/booking-notifications";
import { loadBookingRecord, type BookingStatus } from "@/server/queries/booking-record";

const siteUrl = () => getPublicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
const NO_ONLINE_PAYMENT = "Online payment isn't available yet. Please contact us to book.";

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) (errors[issue.path.join(".") || "form"] ??= []).push(issue.message);
  return errors;
}

/**
 * Public booking submit: validate → honeypot → rate limit → Turnstile →
 * create_booking (service role; it enforces every rule) → PayMongo checkout for
 * the deposit. Returns where to send the browser next.
 */
export async function submitBooking(
  input: unknown,
): Promise<ActionResult<{ redirectUrl: string; reference: string }>> {
  const parsed = publicBookingSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please check the highlighted fields.", fieldErrors(parsed.error.issues));
  }
  const v = parsed.data;

  if (!(await rateLimit("book", 5, 600))) {
    return fail("Too many attempts. Please wait a few minutes and try again.");
  }

  const supabase = createAdminClient();
  try {
    // Refuse before holding a slot if a deposit is due but payments aren't set up
    // (checked before Turnstile so visitors get the clear message, not a security error).
    if (!paymongoConfigured()) {
      const [{ data: service }, { data: settings }, { data: addOns }] = await Promise.all([
        supabase
          .from("services")
          .select(
            "price_cents, deposit_cents, category, workshop_regular_enabled, workshop_early_bird_enabled, workshop_early_bird_price_cents, workshop_student_enabled, workshop_student_price_cents",
          )
          .eq("id", v.serviceId)
          .maybeSingle(),
        supabase.from("business_settings").select("default_deposit_percent, vat_percent").single(),
        supabase.from("add_ons").select("price_cents").in("id", v.addOnIds),
      ]);
      const { deposit } = bookingTotals({
        // Workshops are priced per person, by category.
        packageCents:
          service?.category === "workshop"
            ? attendeesCents((v.attendees ?? []).slice(0, v.participants), workshopPrices(service))
            : (service?.price_cents ?? 0),
        addOnsCents: (addOns ?? []).reduce((sum, a) => sum + a.price_cents, 0),
        vatPercent: settings?.vat_percent ?? 0,
        fixedDepositCents: service?.deposit_cents ?? null,
        depositPercent: settings?.default_deposit_percent ?? 0,
        payInFull: v.payInFull,
      });
      if (deposit > 0) return fail(NO_ONLINE_PAYMENT);
    }

    if (!(await verifyTurnstile(v.turnstileToken, await clientIp()))) {
      return fail("Please complete the security check and try again.");
    }

    const { data, error } = await supabase
      .rpc("create_booking", {
        p_full_name: v.fullName,
        p_email: v.email,
        p_phone: v.phone,
        p_preferred_contact: v.preferredContact,
        p_consent_version: CONSENT_VERSION,
        p_service_id: v.serviceId,
        p_start_at: v.startAt,
        p_location: v.location ?? undefined,
        p_participants: v.participants,
        p_special_requests: v.specialRequests ?? undefined,
        p_messenger: v.messenger ?? undefined,
        p_add_on_ids: v.addOnIds,
        p_pay_in_full: v.payInFull,
        // Workshops: names for the certificates (only as many as are coming).
        // Workshops: each person's certificate name, category and student ID.
        p_attendees:
          v.payInFull !== undefined
            ? (v.attendees ?? []).slice(0, v.participants).map((a) => ({
                name: a.name,
                phone: a.phone,
                address: a.address,
                category: a.category,
                id_path: a.idPath || null,
              }))
            : undefined,
      })
      .single();
    if (error) {
      const code = bookingErrorCode(error.message);
      if (!code) throw error;
      const field =
        code === "slot_unavailable"
          ? "startAt"
          : code === "add_on_unavailable"
            ? "addOnIds"
            : code === "workshop_full" || code === "invalid_participants"
              ? "participants"
              : code === "invalid_attendees" ||
                  code === "attendee_contact_required" ||
                  code === "category_unavailable" ||
                  code === "student_id_required" ||
                  code === "early_bird_closed" ||
                  code === "early_bird_full"
                ? "attendees"
                : null;
      return fail(BOOKING_ERRORS[code]!, field ? { [field]: [BOOKING_ERRORS[code]!] } : undefined);
    }

    if (data.deposit_cents > 0) {
      const url = await startCheckout(data.booking_id, data.reference_code, data.deposit_cents, v);
      if (!url) {
        // Don't keep holding a slot nobody can pay for.
        await supabase.from("bookings").update({ status: "cancelled" }).eq("id", data.booking_id);
        return fail("We couldn't start the payment. Please try again in a moment.");
      }
      return ok({ redirectUrl: url, reference: data.reference_code });
    }

    const record = await loadBookingRecord({ id: data.booking_id });
    if (record) await notifyBookingReceived(record);
    return ok({
      redirectUrl: `/book/done?ref=${data.reference_code}`,
      reference: data.reference_code,
    });
  } catch (error) {
    console.error("[submitBooking]", error);
    return fail("Something went wrong. Please try again.");
  }
}

/** Creates a PayMongo checkout for the deposit and records it as a pending payment. */
async function startCheckout(
  bookingId: string,
  reference: string,
  amountCents: number,
  client: { fullName: string; email: string; phone?: string },
): Promise<string | null> {
  try {
    const { data: booking } = await createAdminClient()
      .from("bookings")
      .select("price_cents, service:services(name)")
      .eq("id", bookingId)
      .single();
    const session = await createCheckoutSession({
      referenceCode: reference,
      amountCents,
      description: `${amountCents >= (booking?.price_cents ?? Infinity) ? "Payment" : "Deposit"} · ${booking?.service?.name ?? "Photo session"} (${reference})`,
      successUrl: `${siteUrl()}/book/done?ref=${reference}`,
      cancelUrl: `${siteUrl()}/book/cancelled?ref=${reference}`,
      name: client.fullName,
      email: client.email,
      phone: client.phone,
    });
    const { error } = await createAdminClient().from("payments").insert({
      booking_id: bookingId,
      provider: "paymongo",
      provider_checkout_id: session.id,
      amount_cents: amountCents,
      status: "pending",
    });
    if (error) throw error;
    return session.checkoutUrl;
  } catch (error) {
    console.error("[startCheckout]", error);
    return null;
  }
}

/** The booking for this reference, only if the email matches (never reveal which part was wrong). */
async function findOwnBooking(input: unknown) {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: fail("Please check the highlighted fields.", fieldErrors(parsed.error.issues)),
    };
  if (!(await rateLimit("lookup", 10, 600))) {
    return { error: fail("Too many attempts. Please wait a few minutes and try again.") };
  }
  const record = await loadBookingRecord({ reference: parsed.data.reference });
  if (!record || record.email?.toLowerCase() !== parsed.data.email) {
    return { error: fail("We couldn't find a booking with that reference and email.") };
  }
  return { record };
}

export type ClientBookingView = {
  summary: BookingSummary;
  status: BookingStatus;
  holdExpiresAt: string | null;
};

/** /booking: a client views their own booking with reference + email. */
export async function lookupBooking(input: unknown): Promise<ActionResult<ClientBookingView>> {
  try {
    const { record, error } = await findOwnBooking(input);
    if (error) return error;
    return ok({
      summary: record.summary,
      status: record.status,
      holdExpiresAt: record.holdExpiresAt,
    });
  } catch (error) {
    console.error("[lookupBooking]", error);
    return fail("Something went wrong. Please try again.");
  }
}

/** /book/cancelled: start a new checkout while the slot is still held. */
export async function resumePayment(
  input: unknown,
): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    const { record, error } = await findOwnBooking(input);
    if (error) return error;
    const holdLive =
      record.status === "pending_payment" &&
      record.holdExpiresAt !== null &&
      new Date(record.holdExpiresAt) > new Date();
    if (!holdLive) {
      return fail(
        record.status === "pending_payment" || record.status === "expired"
          ? "This booking's hold has expired. Please book again."
          : "This booking doesn't need a payment right now.",
      );
    }
    if (!paymongoConfigured()) return fail(NO_ONLINE_PAYMENT);
    const url = await startCheckout(record.id, record.summary.reference, record.depositCents, {
      fullName: record.summary.contactName,
      email: record.email!,
    });
    return url
      ? ok({ redirectUrl: url })
      : fail("We couldn't start the payment. Please try again.");
  } catch (error) {
    console.error("[resumePayment]", error);
    return fail("Something went wrong. Please try again.");
  }
}
