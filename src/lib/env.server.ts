import "server-only";

import { z } from "zod";

import { publicEnvSchema } from "@/lib/env";

/** Server-only env vars. Integrations not built yet are optional for now. */
export const serverEnvSchema = publicEnvSchema.extend({
  BUSINESS_TIMEZONE: z.string().default("Asia/Manila"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  PAYMONGO_SECRET_KEY: z.string().optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Validated server env. Throws on first use if anything required is missing. */
export function getServerEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}
