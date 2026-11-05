"use server";

import { BOOKING_ERRORS, bookingErrorCode } from "@/lib/booking/booking-errors";
import { contractHash, packageContract } from "@/lib/booking/contract";
import { cleanSignature, signatureMatches } from "@/lib/booking/signature";
import type { BookingSummary } from "@/lib/booking/booking-summary";
import { bookingTotals } from "@/lib/booking/pricing";
import { attendeesCents, workshopPrices } from "@/lib/booking/workshop";
import { getPublicEnv } from "@/lib/env";
import { createCheckoutSession, paymongoConfigured } from "@/lib/payments/paymongo";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import { CLIENT_STATUS_LABELS } from "@/lib/booking/status";
import { bookingListEmail } from "@/lib/email/booking-emails";
import { sendEmail } from "@/lib/email/send";
import {
  CONSENT_VERSION,
  lookupSchema,
  publicBookingSchema,
  remindSchema,
  rescheduleRequestSchema,
} from "@/lib/validations/booking";
import { notifyBookingReceived, notifyRescheduleRequest } from "@/server/booking-notifications";
import {
  listBookingsForEmail,
  loadBookingRecord,
  type BookingStatus,
} from "@/server/queries/booking-record";

const siteUrl = () => getPublicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
const NO_ONLINE_PAYMENT = "Online payment isn't available yet. Please contact us to book.";
/** Smallest balance we offer to take online (PayMongo won't take tiny amounts). */
const MIN_ONLINE_BALANCE_CENTS = 10_000;

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
): Promise<ActionResult<{ redirectUrl: string; reference: string; holdExpiresAt: string | null }>> {
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

    // The package's contract: the client must have agreed to the wording that's
    // current now (checked before Turnstile so a retry doesn't waste the token).
    const { data: terms, error: termsError } = await supabase
      .from("services")
      .select("contract")
      .eq("id", v.serviceId)
      .maybeSingle();
    if (termsError) throw termsError;
    const contract = packageContract(terms?.contract);
    if (contract) {
      if (!signatureMatches(v.contractSignature, v.fullName)) {
        const message = `Type your full name exactly as on your details (${v.fullName}) to sign the contract.`;
        return fail(message, { contractSignature: [message] });
      }
      if (v.contractAccepted !== true) {
        const message = "Please read the contract and tick to agree before booking.";
        return fail(message, { contractAccepted: [message] });
      }
      if (v.contractHash !== contractHash(contract)) {
        const message =
          "The contract for this package was just updated. Please read it again and tick to agree.";
        return fail(message, { contractAccepted: [message] });
      }
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

    // Keep the exact wording they agreed to with the booking.
    if (contract) {
      const { error: saveError } = await supabase
        .from("bookings")
        .update({
          contract_text: contract,
          contract_accepted_at: new Date().toISOString(),
          contract_signed_name: cleanSignature(v.contractSignature!),
        })
        .eq("id", data.booking_id);
      if (saveError) console.error("[submitBooking] save contract", saveError);
    }

    if (data.deposit_cents > 0) {
      const url = await startCheckout(data.booking_id, data.reference_code, data.deposit_cents, v);
      if (!url) {
        // Don't keep holding a slot nobody can pay for.
        await supabase.from("bookings").update({ status: "cancelled" }).eq("id", data.booking_id);
        return fail("We couldn't start the payment. Please try again in a moment.");
      }
      return ok({
        redirectUrl: url,
        reference: data.reference_code,
        holdExpiresAt: data.hold_expires_at,
      });
    }

    const record = await loadBookingRecord({ id: data.booking_id });
    if (record) await notifyBookingReceived(record);
    return ok({
      redirectUrl: `/book/done?ref=${data.reference_code}`,
      reference: data.reference_code,
      holdExpiresAt: null,
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
  purpose: "deposit" | "balance" = "deposit",
): Promise<string | null> {
  try {
    const { data: booking } = await createAdminClient()
      .from("bookings")
      .select("price_cents, service:services(name)")
      .eq("id", bookingId)
      .single();
    // What the client is paying for, on the checkout page and PayMongo's receipt.
    const kind =
      purpose === "balance"
        ? "Balance"
        : amountCents >= (booking?.price_cents ?? Infinity)
          ? "Payment"
          : "Deposit";
    const session = await createCheckoutSession({
      referenceCode: reference,
      amountCents,
      kind,
      description: `${kind} · ${booking?.service?.name ?? "Photo session"} (${reference})`,
      // A balance is paid from /booking, so the client goes back there.
      successUrl:
        purpose === "balance"
          ? `${siteUrl()}/booking?ref=${reference}&paid=1`
          : `${siteUrl()}/book/done?ref=${reference}`,
      cancelUrl:
        purpose === "balance"
          ? `${siteUrl()}/booking?ref=${reference}`
          : `${siteUrl()}/book/cancelled?ref=${reference}`,
      name: client.fullName,
      email: client.email,
      phone: client.phone,
    });
    const { error } = await createAdminClient()
      .from("payments")
      .insert({
        booking_id: bookingId,
        provider: "paymongo",
        provider_checkout_id: session.id,
        amount_cents: amountCents,
        status: "pending",
        // Deposits use the column default, so they don't depend on the balance migration.
        ...(purpose === "balance" ? { purpose } : {}),
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
  balanceCents: number;
  /** The balance can be paid online now (upcoming, active, big enough, PayMongo set up). */
  canPayBalance: boolean;
  /** "Ask to reschedule" is offered (upcoming and active, no request waiting). */
  canRequestChange: boolean;
  /** A reschedule request the studio hasn't handled yet. */
  openRequest: { createdAt: string; preferred: string | null } | null;
  contract: { text: string; acceptedAt: string; signedName: string | null } | null;
};

type OwnBooking = NonNullable<Awaited<ReturnType<typeof loadBookingRecord>>>;

const isUpcomingActive = (r: OwnBooking) =>
  (r.status === "pending" || r.status === "confirmed") && new Date(r.summary.startAt) > new Date();

async function openRequestFor(bookingId: string) {
  const { data, error } = await createAdminClient()
    .from("booking_requests")
    .select("created_at, preferred")
    .eq("booking_id", bookingId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { createdAt: data.created_at, preferred: data.preferred } : null;
}

async function clientView(record: OwnBooking): Promise<ClientBookingView> {
  const balanceCents = Math.max(record.summary.priceCents - record.summary.paidCents, 0);
  const active = isUpcomingActive(record);
  const openRequest = active ? await openRequestFor(record.id) : null;
  return {
    summary: record.summary,
    status: record.status,
    holdExpiresAt: record.holdExpiresAt,
    balanceCents,
    canPayBalance:
      active &&
      record.email !== null &&
      balanceCents >= MIN_ONLINE_BALANCE_CENTS &&
      paymongoConfigured(),
    canRequestChange: active && !openRequest,
    openRequest,
    contract: record.contract,
  };
}

/** /booking: a client views their own booking with reference + email. */
export async function lookupBooking(input: unknown): Promise<ActionResult<ClientBookingView>> {
  try {
    const { record, error } = await findOwnBooking(input);
    if (error) return error;
    return ok(await clientView(record));
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

/**
 * "Forgot your reference?": emails the bookings made with this address to that
 * address. The answer is the same whether or not any exist, so it never reveals
 * who has booked. Limited per visitor and per address so it can't flood an inbox.
 */
export async function emailMyBookings(input: unknown): Promise<ActionResult<{ email: string }>> {
  try {
    const parsed = remindSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please check the highlighted fields.", fieldErrors(parsed.error.issues));
    }
    const { email } = parsed.data;
    if (!(await rateLimit("remind", 5, 600)) || !(await rateLimit("remind-to", 3, 3600, email))) {
      return fail("Too many requests. Please wait a while and try again.");
    }
    const { bookings, studio } = await listBookingsForEmail(email);
    if (bookings.length > 0) {
      await sendEmail({
        to: email,
        ...bookingListEmail(
          bookings.map((b) => ({ ...b, statusLabel: CLIENT_STATUS_LABELS[b.status] })),
          studio,
          siteUrl(),
        ),
      });
    }
    return ok({ email });
  } catch (error) {
    console.error("[emailMyBookings]", error);
    return fail("Something went wrong. Please try again.");
  }
}

/** /booking: pay the rest of the price online (a "balance" PayMongo checkout). */
export async function payBalance(input: unknown): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    const { record, error } = await findOwnBooking(input);
    if (error) return error;
    const view = await clientView(record);
    if (!view.canPayBalance) {
      return fail(
        view.balanceCents === 0
          ? "This booking is already fully paid."
          : "The balance can't be paid online for this booking. Please contact us.",
      );
    }
    const url = await startCheckout(
      record.id,
      record.summary.reference,
      view.balanceCents,
      { fullName: record.summary.contactName, email: record.email! },
      "balance",
    );
    return url
      ? ok({ redirectUrl: url })
      : fail("We couldn't start the payment. Please try again.");
  } catch (error) {
    console.error("[payBalance]", error);
    return fail("Something went wrong. Please try again.");
  }
}

/**
 * /booking: "Ask to reschedule". Saved for the studio to handle (Admin → the
 * booking) and emailed to them; nothing moves until staff change the time.
 */
export async function requestReschedule(
  input: unknown,
): Promise<ActionResult<{ createdAt: string; preferred: string | null }>> {
  try {
    const parsed = rescheduleRequestSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please check the highlighted fields.", fieldErrors(parsed.error.issues));
    }
    if (!(await rateLimit("reschedule", 5, 3600))) {
      return fail("Too many requests. Please wait a while and try again.");
    }
    const { record, error } = await findOwnBooking(parsed.data);
    if (error) return error;
    if (!isUpcomingActive(record)) {
      return fail("This booking can't be changed online. Please contact us.");
    }
    if (await openRequestFor(record.id)) {
      return fail("You've already asked to reschedule. We'll get back to you soon.");
    }
    const { preferred, message } = parsed.data;
    const { data, error: insertError } = await createAdminClient()
      .from("booking_requests")
      .insert({ booking_id: record.id, kind: "reschedule", preferred, message })
      .select("created_at")
      .single();
    if (insertError) throw insertError;
    await notifyRescheduleRequest(record, { preferred, message });
    return ok({ createdAt: data.created_at, preferred });
  } catch (error) {
    console.error("[requestReschedule]", error);
    return fail("Something went wrong. Please try again.");
  }
}
