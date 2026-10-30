import "server-only";

import type { PaidEvent } from "@/lib/payments/paymongo";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyBookingReceived } from "@/server/booking-notifications";
import { loadBookingRecord } from "@/server/queries/booking-record";
import type { Json } from "@/types/database.types";

/**
 * Records a paid PayMongo checkout: de-duplicates by event id, settles the
 * booking (mark_booking_paid) and sends the "booking received" emails. Shared
 * by the verified webhook and the trial-mode pretend checkout.
 */
export async function settlePaidEvent(
  event: PaidEvent,
  raw: Json,
): Promise<"ok" | "duplicate" | "error"> {
  const supabase = createAdminClient();
  const { error: seen } = await supabase.from("payment_webhook_events").insert({
    event_id: event.eventId,
    event_type: "checkout_session.payment.paid",
    payload: raw,
  });
  if (seen?.code === "23505") return "duplicate";
  if (seen) {
    console.error("[settle payment] record event", seen);
    return "error";
  }

  const { data, error } = await supabase
    .rpc("mark_booking_paid", {
      p_reference: event.reference,
      p_checkout_id: event.checkoutId,
      p_payment_id: event.paymentId,
      p_amount_cents: event.amountCents,
      p_raw: raw,
    })
    .single();
  if (error || !data) {
    console.error("[settle payment] settle", error);
    // Forget the event so PayMongo's retry is processed instead of skipped.
    await supabase.from("payment_webhook_events").delete().eq("event_id", event.eventId);
    return "error";
  }

  await supabase
    .from("payment_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", event.eventId);

  if (data.booking_id && ["paid", "paid_late", "needs_review"].includes(data.outcome)) {
    const record = await loadBookingRecord({ id: data.booking_id });
    if (record) await notifyBookingReceived(record);
  }
  if (data.outcome === "unknown_booking") {
    console.error("[settle payment] payment for unknown booking", event.reference);
  }
  return "ok";
}
