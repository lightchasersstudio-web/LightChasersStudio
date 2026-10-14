import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { PublicBucket } from "@/lib/storage";
import type { Database } from "@/types/database.types";

/** Delete storage objects after their row is gone; a leftover file is harmless, so only log. */
export async function removeObjects(
  supabase: SupabaseClient<Database>,
  bucket: PublicBucket,
  paths: string[],
) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) console.error(`[storage] failed to remove from ${bucket}`, paths, error.message);
}
