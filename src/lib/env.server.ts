import "server-only";

import { z } from "zod";

import { publicEnvSchema } from "@/lib/env";
import { PAYMENT_METHODS } from "@/lib/payments/methods";

/** Server-only env vars. Integrations not built yet are optional for now. */
export const serverEnvSchema = publicEnvSchema.extend({
  BUSINESS_TIMEZONE: z.string().default("Asia/Manila"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  GMAIL_USER: z.email().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  PAYMONGO_SECRET_KEY: z.string().optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().optional(),
  // Comma list of methods activated on the PayMongo account, e.g. "qrph,paymaya,gcash".
  PAYMONGO_PAYMENT_METHODS: z
    .string()
    .default("qrph")
    .transform((s) => [...new Set(s.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean))])
    .pipe(z.array(z.enum(PAYMENT_METHODS)).min(1)),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Validated server env. Throws on first use if anything required is missing. */
export function getServerEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}
