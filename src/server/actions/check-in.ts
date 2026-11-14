"use server";

import { CHECK_IN_STEPS, checkInColumn, type CheckInColumn } from "@/lib/booking/check-in";
import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import { formatPeso } from "@/lib/utils/money";
import {
  bookingIdSchema,
  checkInStepSchema,
  collectDepositSchema,
  returnDepositSchema,
} from "@/lib/validations/admin-booking";
import { adminAction, audit, revalidate, TAGS } from "@/server/admin-action";

// Shoot day (owner request 2026-11-14, Studio Policy 2.3, 2.5, 3.9). Who did
// what, and when, is kept in the audit log (booking History).

/** Bookings that can be checked in: going ahead or done (to fix a step after). */
const OPEN = ["pending", "confirmed", "completed"];

async function loadBooking(ctx: Parameters<Parameters<typeof adminAction>[2]>[1], id: string) {
  const { data, error } = await ctx.supabase
    .from("bookings")
    .select(
      "id, status, security_deposit_cents, security_deposit_returned_at, security_deposit_method",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Ticks (or unticks) ID checked, check-in inspection or check-out inspection. */
export async function setCheckInStep(input: unknown): Promise<ActionResult> {
  return adminAction(checkInStepSchema, input, async ({ bookingId, step, done }, ctx) => {
    const booking = await loadBooking(ctx, bookingId);
    if (!booking) return fail("Booking not found.");
    if (!OPEN.includes(booking.status)) return fail(`This booking is ${booking.status}.`);
    const patch: Partial<Record<CheckInColumn, string | null>> = {
      [checkInColumn(step)]: done ? new Date().toISOString() : null,
    };
    const { error } = await ctx.supabase.from("bookings").update(patch).eq("id", bookingId);
    if (error) throw error;
    await audit(ctx, done ? "booking.check_in" : "booking.check_in_undo", "booking", bookingId, {
      step: CHECK_IN_STEPS.find((s) => s.step === step)!.label,
    });
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}

/** Records the refundable security deposit received (policy 3.9). */
export async function collectSecurityDeposit(input: unknown): Promise<ActionResult> {
  return adminAction(collectDepositSchema, input, async (v, ctx) => {
    const booking = await loadBooking(ctx, v.bookingId);
    if (!booking) return fail("Booking not found.");
    if (!OPEN.includes(booking.status)) return fail(`This booking is ${booking.status}.`);
    if (booking.security_deposit_cents !== null) {
      return fail("A security deposit is already recorded for this booking.");
    }
    const { error } = await ctx.supabase
      .from("bookings")
      .update({
        security_deposit_cents: v.amountCents,
        security_deposit_method: v.method,
        security_deposit_collected_at: new Date().toISOString(),
      })
      .eq("id", v.bookingId);
    if (error) throw error;
    await audit(ctx, "booking.deposit_collect", "booking", v.bookingId, {
      amount_cents: v.amountCents,
      provider: v.method,
    });
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}

/**
 * Gives the security deposit back at check-out. Anything kept (cleaning,
 * repairs, policy 3.9) needs a short reason, shown on the booking.
 */
export async function returnSecurityDeposit(input: unknown): Promise<ActionResult> {
  return adminAction(returnDepositSchema, input, async (v, ctx) => {
    const booking = await loadBooking(ctx, v.bookingId);
    if (!booking) return fail("Booking not found.");
    const held = booking.security_deposit_cents;
    if (held === null) return fail("No security deposit was collected.");
    if (booking.security_deposit_returned_at) return fail("The deposit was already returned.");
    if (v.returnedCents > held) {
      const message = `That's more than the ${formatPeso(held)} collected.`;
      return fail(message, { returned: [message] });
    }
    if (v.returnedCents < held && !v.note) {
      const message = "Say what the kept amount is for, like “Cleaning fee”.";
      return fail(message, { note: [message] });
    }
    const { error } = await ctx.supabase
      .from("bookings")
      .update({
        security_deposit_returned_cents: v.returnedCents,
        security_deposit_returned_at: new Date().toISOString(),
        security_deposit_note: v.note,
      })
      .eq("id", v.bookingId);
    if (error) throw error;
    await audit(ctx, "booking.deposit_return", "booking", v.bookingId, {
      amount_cents: v.returnedCents,
      kept_cents: held - v.returnedCents,
      provider: booking.security_deposit_method ?? undefined,
    });
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}

/** Removes a deposit recorded by mistake (only while it hasn't been returned). */
export async function undoSecurityDeposit(input: unknown): Promise<ActionResult> {
  return adminAction(bookingIdSchema, input, async ({ id }, ctx) => {
    const booking = await loadBooking(ctx, id);
    if (!booking) return fail("Booking not found.");
    if (booking.security_deposit_returned_at) {
      return fail("It was already returned, so it can't be removed.");
    }
    const { error } = await ctx.supabase
      .from("bookings")
      .update({
        security_deposit_cents: null,
        security_deposit_method: null,
        security_deposit_collected_at: null,
      })
      .eq("id", id);
    if (error) throw error;
    await audit(ctx, "booking.deposit_undo", "booking", id, {
      amount_cents: booking.security_deposit_cents,
      provider: booking.security_deposit_method ?? undefined,
    });
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}
