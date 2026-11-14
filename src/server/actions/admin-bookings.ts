"use server";

import { z } from "zod";

import {
  BOOKING_ERRORS,
  bookingErrorCode,
  isScheduleClash,
  STAFF_SCHEDULE_ERRORS,
} from "@/lib/booking/booking-errors";
import { chargeLine } from "@/lib/booking/charges";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import {
  adminBookingEditSchema,
  adminBookingSchema,
  adminNotesSchema,
  bookingChargeSchema,
  bookingIdSchema,
  bookingStatusSchema,
  bookingVatSchema,
  deleteBookingSchema,
  paymentIdSchema,
  recordPaymentSchema,
  removeChargeSchema,
  reviewStudentIdSchema,
} from "@/lib/validations/admin-booking";
import { CONSENT_VERSION } from "@/lib/validations/booking";
import { adminAction, audit, PG, revalidate, TAGS } from "@/server/admin-action";
import {
  notifyBookingClosed,
  notifyBookingCompleted,
  notifyBookingConfirmed,
  notifyBookingUpdated,
  resendLatestEmail,
} from "@/server/booking-notifications";
import {
  loadMonthAvailability,
  toPayload,
  type MonthSlotsPayload,
} from "@/server/queries/availability-slots";
import { loadBookingRecord } from "@/server/queries/booking-record";
import { emailReceipt, loadReceipt } from "@/server/receipts";

/** The booking line added when a booking is moved (see services.reschedule_fee_cents). */
const RESCHEDULE_FEE_NAME = "Rescheduling fee";

const monthSlotsSchema = z.object({
  serviceId: z.uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  excludeBookingId: z.uuid().optional(),
  addOnIds: z.array(z.uuid()).max(20).default([]),
});

/** Free times for staff: any package, ignoring the notice period and booking window. */
export async function getAdminMonthSlots(input: unknown): Promise<ActionResult<MonthSlotsPayload>> {
  return adminAction(
    monthSlotsSchema,
    input,
    async ({ serviceId, month, excludeBookingId, addOnIds }, ctx) => {
      const days = await loadMonthAvailability(ctx.supabase, serviceId, month, {
        staff: true,
        excludeBookingId,
        addOnIds,
      });
      return days ? ok(toPayload(days)) : fail("Package not found.");
    },
  );
}

/**
 * Staff book a client in. admin_create_booking is service-role only, so it runs
 * through the admin client after adminAction() has confirmed the caller is an admin.
 */
export async function createAdminBooking(input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction(adminBookingSchema, input, async (v, ctx) => {
    const { data, error } = await createAdminClient()
      .rpc("admin_create_booking", {
        p_full_name: v.fullName,
        p_email: v.email ?? "",
        p_phone: v.phone,
        p_preferred_contact: v.preferredContact,
        p_messenger: v.messenger ?? "",
        p_service_id: v.serviceId,
        p_start_at: v.startAt,
        p_price_cents: v.priceCents,
        p_allow_outside_hours: v.allowOutsideHours,
        p_location: v.location ?? "",
        p_participants: v.participants,
        p_special_requests: v.specialRequests ?? "",
        p_payment_provider: v.payment?.provider ?? "",
        p_payment_amount_cents: v.payment?.amountCents ?? 0,
        p_payment_reference: v.payment?.reference ?? "",
        p_admin_id: ctx.admin.userId,
        p_add_ons: v.addOns,
      })
      .single();
    if (error) {
      const code = bookingErrorCode(error.message);
      if (code === "outside_business_hours" || code === "blackout_date") {
        return fail(
          code === "blackout_date"
            ? "That day is blocked on your calendar."
            : "That time is outside your opening hours.",
          // The form shows this as a warning with a "Book anyway" button.
          { allowOutsideHours: ["needs-confirm"] },
        );
      }
      if (code) {
        const message = STAFF_SCHEDULE_ERRORS[code] ?? BOOKING_ERRORS[code]!;
        return fail(message, isScheduleClash(code) ? { time: [message] } : undefined);
      }
      throw error;
    }

    await audit(ctx, "booking.create", "booking", data.booking_id, {
      reference: data.reference_code,
      consent: `admin-${CONSENT_VERSION}`,
    });
    const record = await loadBookingRecord({ id: data.booking_id });
    if (record) await notifyBookingConfirmed(record);
    // A payment taken while booking them in gets its receipt too.
    if (record?.email && v.payment) {
      const { data: paid } = await ctx.supabase
        .from("payments")
        .select("id")
        .eq("booking_id", data.booking_id)
        .eq("status", "paid");
      for (const p of paid ?? []) await emailReceipt(p.id);
    }
    revalidate(TAGS.bookings);
    return ok({ id: data.booking_id });
  });
}

/**
 * Confirm / decline / complete / cancel / no-show. The DB trigger rejects moves
 * that don't make sense. Cancelling records why (studio policy 1.6–1.8): force
 * majeure flags the booking for a full refund of what was paid.
 */
export async function setBookingStatus(input: unknown): Promise<ActionResult> {
  return adminAction(bookingStatusSchema, input, async (v, ctx) => {
    const { id, status, photosUrl } = v;
    const cancelReason = status === "cancelled" ? (v.cancelReason ?? "client") : null;
    let refund = false;
    if (cancelReason === "force_majeure") {
      const before = await loadBookingRecord({ id });
      refund = (before?.summary.paidCents ?? 0) > 0;
    }
    const { data, error } = await ctx.supabase
      .from("bookings")
      .update({
        status,
        ...(cancelReason ? { cancel_reason: cancelReason } : {}),
        ...(refund ? { needs_refund_review: true } : {}),
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error?.code === PG.check) return fail("This booking can't be changed to that status.");
    if (error) throw error;
    if (!data) return fail("Booking not found.");

    const photos = status === "completed" ? (photosUrl ?? null) : null;
    await audit(
      ctx,
      `booking.${status}`,
      "booking",
      id,
      photos ? { photos_url: photos } : cancelReason ? { reason: cancelReason } : undefined,
    );
    const record = await loadBookingRecord({ id });
    if (record && status === "confirmed") await notifyBookingConfirmed(record);
    if (record && status === "completed") await notifyBookingCompleted(record, photos);
    if (record && (status === "declined" || status === "cancelled")) {
      await notifyBookingClosed(record, status);
    }
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}

/** GCash or cash received outside the website (e.g. the balance on the day). */
export async function recordPayment(
  input: unknown,
): Promise<ActionResult<{ receiptEmailed: boolean }>> {
  return adminAction(recordPaymentSchema, input, async (v, ctx) => {
    const record = await loadBookingRecord({ id: v.bookingId });
    if (!record) return fail("Booking not found.");
    // The form is hidden for these; refuse here too so a stale page can't add money.
    if (["cancelled", "declined", "expired"].includes(record.status)) {
      return fail(`This booking is ${record.status}, so payments can't be added to it.`);
    }
    const balance = record.summary.priceCents - record.summary.paidCents;
    if (v.amountCents > balance) {
      return fail("That's more than the balance.", { amount: ["That's more than the balance."] });
    }
    // payments have no admin insert policy: written with the service role after assertAdmin().
    const { data: payment, error } = await createAdminClient()
      .from("payments")
      .insert({
        booking_id: v.bookingId,
        provider: v.provider,
        amount_cents: v.amountCents,
        status: "paid",
        paid_at: new Date().toISOString(),
        reference: v.reference,
        recorded_by: ctx.admin.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    await audit(ctx, "payment.record", "booking", v.bookingId, {
      provider: v.provider,
      amount_cents: v.amountCents,
    });
    // The receipt goes to the client straight away (studio policy 1.5).
    const emailed = await emailReceipt(payment.id);
    revalidate(TAGS.bookings);
    return ok({ receiptEmailed: emailed });
  });
}

/**
 * Adds or waives VAT on one booking. VAT is worked out from the price before VAT
 * at the studio's current rate; the total (and so the balance) changes, while
 * payments already made and the deposit stay as they are.
 */
export async function setBookingVat(input: unknown): Promise<ActionResult> {
  return adminAction(bookingVatSchema, input, async ({ id, chargeVat }, ctx) => {
    const [{ data: booking, error }, { data: settings, error: settingsError }] = await Promise.all([
      ctx.supabase.from("bookings").select("price_cents, vat_cents").eq("id", id).maybeSingle(),
      ctx.supabase.from("business_settings").select("vat_percent").single(),
    ]);
    if (error) throw error;
    if (settingsError) throw settingsError;
    if (!booking) return fail("Booking not found.");

    const beforeVat = booking.price_cents - booking.vat_cents;
    const vat = chargeVat ? Math.round((beforeVat * settings.vat_percent) / 100) : 0;
    const { data, error: updateError } = await ctx.supabase
      .from("bookings")
      .update({ price_cents: beforeVat + vat, vat_cents: vat })
      .eq("id", id)
      .eq("vat_cents", booking.vat_cents) // someone else changed it meanwhile: don't double up
      .select("id")
      .maybeSingle();
    if (updateError?.code === PG.check) {
      return fail("The total can't go below the deposit for this booking.");
    }
    if (updateError) throw updateError;
    if (!data) return fail("This booking just changed. Refresh and try again.");

    await audit(ctx, chargeVat ? "booking.vat_add" : "booking.vat_remove", "booking", id, {
      vat_cents: vat,
      previous_vat_cents: booking.vat_cents,
    });
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}

export async function saveAdminNotes(input: unknown): Promise<ActionResult> {
  return adminAction(adminNotesSchema, input, async ({ id, notes }, ctx) => {
    const { error } = await ctx.supabase
      .from("bookings")
      .update({ admin_notes: notes })
      .eq("id", id);
    if (error) throw error;
    await audit(ctx, "booking.notes", "booking", id);
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}

export async function resendBookingEmail(input: unknown): Promise<ActionResult> {
  return adminAction(bookingIdSchema, input, async ({ id }, ctx) => {
    const record = await loadBookingRecord({ id });
    if (!record) return fail("Booking not found.");
    if (!record.email) return fail("This client has no email address.");
    if (record.status === "no_show") return fail("There's no email for a no-show.");
    await resendLatestEmail(record);
    await audit(ctx, "booking.email_resent", "booking", id);
    return ok(undefined);
  });
}

/** Clears the "late payment, slot full" flag once staff have refunded or rebooked. */
export async function markRefundReviewed(input: unknown): Promise<ActionResult> {
  return adminAction(bookingIdSchema, input, async ({ id }, ctx) => {
    const { error } = await ctx.supabase
      .from("bookings")
      .update({ needs_refund_review: false })
      .eq("id", id);
    if (error) throw error;
    await audit(ctx, "booking.refund_reviewed", "booking", id);
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}

/**
 * Change an existing booking: time, package, price, add-ons, VAT and details.
 * admin_update_booking re-checks the slot (not counting the booking itself).
 */
export async function updateAdminBooking(input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction(adminBookingEditSchema, input, async (v, ctx) => {
    const { data: before, error: beforeError } = await ctx.supabase
      .from("bookings")
      .select(
        "start_at, service_id, price_cents, vat_cents, add_ons:booking_add_ons(name, price_cents)",
      )
      .eq("id", v.bookingId)
      .maybeSingle();
    if (beforeError) throw beforeError;
    if (!before) return fail("Booking not found.");

    // Moved to a new date or time: add the package's rescheduling fee as a line
    // on the booking (unless staff waived it), so it counts towards the balance.
    const moved = Date.parse(before.start_at) !== Date.parse(v.startAt);
    let addOns = v.addOns;
    let rescheduleFeeCents = 0;
    if (moved && v.addRescheduleFee) {
      const { data: service, error: feeError } = await ctx.supabase
        .from("services")
        .select("reschedule_fee_cents")
        .eq("id", v.serviceId)
        .maybeSingle();
      if (feeError) throw feeError;
      rescheduleFeeCents = service?.reschedule_fee_cents ?? 0;
      if (rescheduleFeeCents > 0) {
        addOns = [
          ...addOns,
          { add_on_id: null, name: RESCHEDULE_FEE_NAME, price_cents: rescheduleFeeCents },
        ];
      }
    }

    const { error } = await createAdminClient()
      .rpc("admin_update_booking", {
        p_booking_id: v.bookingId,
        p_service_id: v.serviceId,
        p_start_at: v.startAt,
        p_package_cents: v.packageCents,
        p_add_ons: addOns,
        p_charge_vat: v.chargeVat,
        p_allow_outside_hours: v.allowOutsideHours,
        p_location: v.location ?? "",
        p_participants: v.participants,
        p_special_requests: v.specialRequests ?? "",
        p_contact_name: v.fullName,
        p_contact_phone: v.phone,
        p_preferred_contact: v.preferredContact,
        p_messenger: v.messenger ?? "",
      })
      .single();
    if (error) {
      const code = bookingErrorCode(error.message);
      if (code === "outside_business_hours" || code === "blackout_date") {
        return fail(
          code === "blackout_date"
            ? "That day is blocked on your calendar."
            : "That time is outside your opening hours.",
          { allowOutsideHours: ["needs-confirm"] },
        );
      }
      if (code) {
        const message = STAFF_SCHEDULE_ERRORS[code] ?? BOOKING_ERRORS[code]!;
        return fail(message, isScheduleClash(code) ? { time: [message] } : undefined);
      }
      if (error.code === PG.check) return fail("Please check the client's name and phone.");
      throw error;
    }

    // Moved with the fee: the client has used their one reschedule (studio policy 1.4).
    // A free move (fee unticked, e.g. force majeure) doesn't count.
    const usedReschedule = moved && v.addRescheduleFee;
    if (usedReschedule) {
      const { error: markError } = await ctx.supabase
        .from("bookings")
        .update({ rescheduled_at: new Date().toISOString() })
        .eq("id", v.bookingId);
      if (markError) throw markError;
    }

    const record = await loadBookingRecord({ id: v.bookingId });
    await audit(ctx, "booking.update", "booking", v.bookingId, {
      before: {
        start_at: before.start_at,
        service_id: before.service_id,
        price_cents: before.price_cents,
        vat_cents: before.vat_cents,
        add_ons: before.add_ons,
      },
      after: {
        start_at: v.startAt,
        service_id: v.serviceId,
        price_cents: record?.summary.priceCents ?? null,
        add_ons: addOns,
      },
      ...(rescheduleFeeCents > 0 ? { reschedule_fee_cents: rescheduleFeeCents } : {}),
      emailed_client: v.emailClient && Boolean(record?.email),
    });
    if (record && v.emailClient) await notifyBookingUpdated(record);
    revalidate(TAGS.bookings);
    return ok({ id: v.bookingId });
  });
}

/**
 * Owner only: permanently delete a booking (tests, mistakes). The owner types the
 * reference to confirm; bookings with real payments are refused (cancel those).
 */
export async function deleteBooking(input: unknown): Promise<ActionResult> {
  return adminAction(deleteBookingSchema, input, async ({ id, confirmReference }, ctx) => {
    if (ctx.admin.role !== "owner") return fail("Only the owner can delete bookings.");
    const { data: booking, error } = await ctx.supabase
      .from("bookings")
      .select("reference_code, contact_name, price_cents, start_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!booking) return fail("Booking not found.");
    if (booking.reference_code !== confirmReference) {
      return fail("The reference doesn't match.", {
        confirmReference: ["Type the booking reference exactly."],
      });
    }

    const { error: deleteError } = await createAdminClient().rpc("delete_booking", {
      p_booking_id: id,
    });
    if (deleteError) {
      const code = bookingErrorCode(deleteError.message);
      if (code) return fail(BOOKING_ERRORS[code]!);
      throw deleteError;
    }
    await audit(ctx, "booking.delete", "booking", id, {
      reference: booking.reference_code,
      contact_name: booking.contact_name,
      price_cents: booking.price_cents,
      start_at: booking.start_at,
    });
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}

export async function reviewStudentId(input: unknown): Promise<ActionResult> {
  return adminAction(reviewStudentIdSchema, input, async ({ attendeeId, status }, ctx) => {
    const { data, error } = await ctx.supabase
      .from("booking_attendees")
      .update({
        id_status: status,
        id_reviewed_at: new Date().toISOString(),
        id_reviewed_by: ctx.admin.userId,
      })
      .eq("id", attendeeId)
      .eq("category", "student")
      .select("booking_id, full_name")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("That student isn't on this booking any more.");
    await audit(ctx, `booking.student_id_${status}`, "booking", data.booking_id, {
      attendee: data.full_name,
    });
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}

/** A client's reschedule request (from /booking) has been dealt with. */
export async function resolveBookingRequest(input: unknown): Promise<ActionResult> {
  return adminAction(bookingIdSchema, input, async ({ id }, ctx) => {
    const { data, error } = await ctx.supabase
      .from("booking_requests")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: ctx.admin.userId,
      })
      .eq("id", id)
      .eq("status", "open")
      .select("booking_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("This request was already handled.");
    await audit(ctx, "booking.request_resolved", "booking", data.booking_id);
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}

const CHARGE_ERRORS: Record<string, string> = {
  booking_not_found: "Booking not found.",
  booking_closed: "Charges can only be added to bookings that are waiting, confirmed or completed.",
  charge_not_found: "That charge is no longer on this booking.",
  invalid_add_ons: "A booking can have up to 20 lines. Remove one first.",
};

const chargeError = (message: string) =>
  Object.entries(CHARGE_ERRORS).find(([code]) => message.includes(code))?.[1];

/**
 * Adds an extra charge after a shoot (studio policy 3.2, 4.4, 5.1, 7.8): a
 * booking line priced from Settings (or typed, for damage), so it counts in the
 * total, VAT and balance. Works on completed bookings too.
 */
export async function addBookingCharge(input: unknown): Promise<ActionResult> {
  return adminAction(bookingChargeSchema, input, async (v, ctx) => {
    const { data: prices, error: pricesError } = await ctx.supabase
      .from("business_settings")
      .select(
        "cleaning_fee_cents, backdrop_paper_yard_cents, extra_person_cents, storage_day_cents",
      )
      .single();
    if (pricesError) throw pricesError;
    const line = chargeLine(
      { kind: v.kind, quantity: v.quantity, amountCents: v.amountCents, note: v.note },
      prices,
    );
    if (line.priceCents <= 0) {
      return fail("This charge is set to ₱0 in Settings → Extra charges.");
    }

    const { error } = await createAdminClient().rpc("admin_add_booking_charge", {
      p_booking_id: v.bookingId,
      p_name: line.name,
      p_price_cents: line.priceCents,
    });
    if (error) {
      const message = chargeError(error.message);
      if (message) return fail(message);
      throw error;
    }
    await audit(ctx, "booking.charge_add", "booking", v.bookingId, {
      charge: line.name,
      price_cents: line.priceCents,
    });
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}

/** Removes an extra charge (or the rescheduling fee) added by mistake. */
export async function removeBookingCharge(input: unknown): Promise<ActionResult> {
  return adminAction(removeChargeSchema, input, async ({ bookingId, lineId }, ctx) => {
    const { data: line, error: lineError } = await ctx.supabase
      .from("booking_add_ons")
      .select("name, price_cents")
      .eq("id", lineId)
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (lineError) throw lineError;
    if (!line) return fail(CHARGE_ERRORS.charge_not_found!);

    const { error } = await createAdminClient().rpc("admin_remove_booking_charge", {
      p_booking_id: bookingId,
      p_line_id: lineId,
    });
    if (error) {
      const message = chargeError(error.message);
      if (message) return fail(message);
      throw error;
    }
    await audit(ctx, "booking.charge_remove", "booking", bookingId, {
      charge: line.name,
      price_cents: line.price_cents,
    });
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}

/** Emails one payment's receipt (PDF attached) to the client again. */
export async function emailPaymentReceipt(input: unknown): Promise<ActionResult> {
  return adminAction(paymentIdSchema, input, async ({ paymentId }, ctx) => {
    const receipt = await loadReceipt(paymentId);
    if (!receipt) return fail("This payment has no receipt (it isn't paid).");
    if (!receipt.record.email) return fail("This client has no email address.");
    if (!(await emailReceipt(paymentId))) return fail("The receipt couldn't be sent. Try again.");
    await audit(ctx, "payment.receipt_emailed", "booking", receipt.record.id, {
      receipt: receipt.data.number,
    });
    return ok(undefined);
  });
}
