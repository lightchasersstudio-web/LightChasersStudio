import "server-only";

import { timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env.server";

/**
 * Vercel cron jobs send "Authorization: Bearer <CRON_SECRET>". Returns a
 * response to send back when the request isn't allowed, or null to go ahead.
 */
export function refuseUnlessCron(req: Request): Response | null {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) return new Response("Cron jobs not configured", { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
