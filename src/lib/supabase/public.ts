import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Anonymous, cookie-free client for public catalogue reads inside "use cache"
 * functions (which can't touch cookies). RLS applies: anon sees public data only.
 */
export function createPublicClient() {
  const env = getPublicEnv();
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
