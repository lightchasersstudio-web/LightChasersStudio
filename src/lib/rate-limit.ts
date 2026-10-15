import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

/** The visitor's IP as reported by the hosting proxy (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/**
 * Fixed-window rate limit stored in Postgres (hit_rate_limit). Returns true while
 * allowed. The IP is hashed so raw addresses are never stored.
 */
export async function rateLimit(action: string, limit: number, windowSeconds: number) {
  const ip = (await clientIp()) ?? "unknown";
  const key = `${action}:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Don't lock everyone out if the limiter itself fails; Turnstile still applies.
    console.error("[rate-limit]", error.message);
    return true;
  }
  return data;
}
