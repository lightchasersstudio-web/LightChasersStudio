import { getServerEnv } from "@/lib/env.server";
import { parsePaidEvent, verifyWebhookSignature } from "@/lib/payments/paymongo";
import type { Json } from "@/types/database.types";
import { settlePaidEvent } from "@/server/settle-payment";

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

  const result = await settlePaidEvent(event, body as Json);
  if (result === "duplicate") return new Response("Already processed", { status: 200 });
  if (result === "error") return new Response("Error", { status: 500 });
  return new Response("OK", { status: 200 });
}
