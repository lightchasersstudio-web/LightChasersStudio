import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env.server";

/**
 * Service-role client. BYPASSES RLS — use only in trusted server code after
 * checking the caller's authorization (e.g. payment webhooks, admin actions).
 */
export function createAdminClient() {
  const env = getServerEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
