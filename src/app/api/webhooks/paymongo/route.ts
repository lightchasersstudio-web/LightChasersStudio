import { getServerEnv } from "@/lib/env.server";
import { parsePaidEvent, verifyWebhookSignature } from "@/lib/payments/paymongo";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { notifyBookingReceived } from "@/server/booking-notifications";
import { loadBookingRecord } from "@/server/queries/booking-record";

/**
 * PayMongo webhook (register it for `checkout_session.payment.paid`). The only
 * place an online deposit is marked paid: signature-verified, idempotent per
 * event id (payment_webhook_events) and per payment id (mark_booking_paid).
 */
export async function POST(req: Request) {
  const secret = getServerEnv().PAYMONGO_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const raw = await req.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const livemode = Boolean(
    (body as { data?: { attributes?: { livemode?: boolean } } })?.data?.attributes?.livemode,
  );
  if (!verifyWebhookSignature(raw, req.headers.get("paymongo-signature"), secret, livemode)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = parsePaidEvent(body);
  if (!event) return new Response("Ignored", { status: 200 });

  const supabase = createAdminClient();
  const { error: seen } = await supabase.from("payment_webhook_events").insert({
    event_id: event.eventId,
    event_type: "checkout_session.payment.paid",
    payload: body as Json,
  });
  if (seen?.code === "23505") return new Response("Already processed", { status: 200 });
  if (seen) {
    console.error("[paymongo webhook] record event", seen);
    return new Response("Error", { status: 500 });
  }

  const { data, error } = await supabase
    .rpc("mark_booking_paid", {
      p_reference: event.reference,
      p_checkout_id: event.checkoutId,
      p_payment_id: event.paymentId,
      p_amount_cents: event.amountCents,
      p_raw: body as Json,
    })
    .single();
  if (error || !data) {
    console.error("[paymongo webhook] settle", error);
    // Forget the event so PayMongo's retry is processed instead of skipped.
    await supabase.from("payment_webhook_events").delete().eq("event_id", event.eventId);
    return new Response("Error", { status: 500 });
  }

  if (data.booking_id && ["paid", "paid_late", "needs_review"].includes(data.outcome)) {
    const record = await loadBookingRecord({ id: data.booking_id });
    if (record) await notifyBookingReceived(record);
  }
  if (data.outcome === "unknown_booking") {
    console.error("[paymongo webhook] payment for unknown booking", event.reference);
  }
  return new Response("OK", { status: 200 });
}
