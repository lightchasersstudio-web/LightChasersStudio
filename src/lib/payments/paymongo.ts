import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env.server";
import { paymentsMockEnabled } from "@/lib/payments/mock";

// PayMongo Checkout Sessions (https://docs.paymongo.com), called with fetch.
// A booking is only ever marked paid by the signature-verified webhook.

const API = "https://api.paymongo.com/v1";
/**
 * Shown on PayMongo's hosted checkout page. Must match the methods enabled on
 * the studio's PayMongo account (2026-10-28: GCash, Maya, card), or the
 * checkout session is refused.
 */
const PAYMENT_METHODS = ["gcash", "paymaya", "card"];
const SIGNATURE_MAX_AGE_SECONDS = 300;

export function paymongoConfigured(): boolean {
  return paymentsMockEnabled() || Boolean(getServerEnv().PAYMONGO_SECRET_KEY);
}

export async function createCheckoutSession(input: {
  referenceCode: string;
  amountCents: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  name?: string;
  email?: string;
  phone?: string;
}): Promise<{ id: string; checkoutUrl: string }> {
  if (paymentsMockEnabled()) {
    // Trial mode: our own pretend checkout page instead of PayMongo's.
    const id = `mock_cs_${crypto.randomUUID().replaceAll("-", "")}`;
    const q = new URLSearchParams({ ref: input.referenceCode, cs: id });
    return { id, checkoutUrl: `/book/mock-checkout?${q}` };
  }
  const key = getServerEnv().PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PAYMONGO_SECRET_KEY is not set");

  const res = await fetch(`${API}/checkout_sessions`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: input.description.slice(0, 255),
              amount: input.amountCents,
              currency: "PHP",
              quantity: 1,
            },
          ],
          payment_method_types: PAYMENT_METHODS,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          reference_number: input.referenceCode,
          description: `Deposit for booking ${input.referenceCode}`,
          send_email_receipt: Boolean(input.email),
          billing: input.name
            ? { name: input.name, email: input.email, phone: input.phone }
            : undefined,
        },
      },
    }),
  });
  const json = (await res.json().catch(() => null)) as {
    data?: { id?: string; attributes?: { checkout_url?: string } };
  } | null;
  const id = json?.data?.id;
  const checkoutUrl = json?.data?.attributes?.checkout_url;
  if (!res.ok || !id || !checkoutUrl) {
    throw new Error(`PayMongo checkout failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return { id, checkoutUrl };
}

/**
 * Checks the `Paymongo-Signature` header: "t=<unix>,te=<test sig>,li=<live sig>",
 * where each signature is HMAC-SHA256(webhook secret, "<t>.<raw body>") in hex.
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  livemode: boolean,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  const given = livemode ? parts.li : parts.te;
  if (!Number.isFinite(t) || !given) return false;
  if (Math.abs(nowSeconds - t) > SIGNATURE_MAX_AGE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type PaidEvent = {
  eventId: string;
  livemode: boolean;
  checkoutId: string;
  reference: string;
  paymentId: string;
  amountCents: number;
};

/**
 * Pulls what we need from a `checkout_session.payment.paid` event; null for any
 * other event. Envelope: data.id / data.attributes.{type, livemode, data}.
 * shortcut: field paths follow PayMongo's docs; confirm against a real test-mode delivery.
 */
export function parsePaidEvent(body: unknown): PaidEvent | null {
  type Raw = {
    data?: {
      id?: string;
      attributes?: {
        type?: string;
        livemode?: boolean;
        data?: {
          id?: string;
          attributes?: {
            reference_number?: string;
            payments?: { id?: string; attributes?: { amount?: number } }[];
          };
        };
      };
    };
  };
  const event = (body as Raw | null)?.data;
  const attrs = event?.attributes;
  if (attrs?.type !== "checkout_session.payment.paid") return null;
  const session = attrs.data;
  const payment = session?.attributes?.payments?.[0];
  if (
    !event?.id ||
    !session?.id ||
    !session.attributes?.reference_number ||
    !payment?.id ||
    typeof payment.attributes?.amount !== "number"
  ) {
    return null;
  }
  return {
    eventId: event.id,
    livemode: Boolean(attrs.livemode),
    checkoutId: session.id,
    reference: session.attributes.reference_number,
    paymentId: payment.id,
    amountCents: payment.attributes.amount,
  };
}
