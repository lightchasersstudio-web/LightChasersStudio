import "server-only";

import { getServerEnv } from "@/lib/env.server";
import { paymentsMockEnabled } from "@/lib/payments/mock";

/**
 * Cloudflare Turnstile check for public forms. Without a secret key the check is
 * skipped in development and in trial mode only; production fails closed.
 */
export async function verifyTurnstile(token: string | undefined, ip: string | null) {
  const secret = getServerEnv().TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production" || paymentsMockEnabled();
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch (error) {
    console.error("[turnstile]", error);
    return false;
  }
}
