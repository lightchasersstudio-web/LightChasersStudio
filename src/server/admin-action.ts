import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh, updateTag } from "next/cache";
import type { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { fail, type ActionResult } from "@/lib/utils/action-result";
import { assertAdmin, type CurrentAdmin } from "@/server/auth";
import type { Database, Json } from "@/types/database.types";

/** Cache tags for public catalogue data. Phase 4's "use cache" queries tag with these. */
export const TAGS = {
  services: "services",
  portfolio: "portfolio",
  settings: "settings",
  availability: "availability",
} as const;

type Ctx = { admin: CurrentAdmin; supabase: SupabaseClient<Database> };

/**
 * Wraps every admin server action: re-checks admin status (layouts don't
 * re-run on client navigation), validates input with the shared zod schema,
 * and turns unexpected errors into a friendly message.
 */
export async function adminAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (data: z.output<S>, ctx: Ctx) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const admin = await assertAdmin();
  if (!admin) return fail("Your session has expired. Please sign in again.");

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return fail("Please check the highlighted fields.", fieldErrors);
  }

  try {
    return await fn(parsed.data, { admin, supabase: await createClient() });
  } catch (error) {
    console.error("[admin action]", error);
    return fail("Something went wrong. Please try again.");
  }
}

/** Expire public caches for these tags and refresh the admin's current page. */
export function revalidate(...tags: (typeof TAGS)[keyof typeof TAGS][]) {
  for (const tag of tags) updateTag(tag);
  refresh();
}

/** Best-effort audit trail; never blocks the action it records. */
export async function audit(
  { admin, supabase }: Ctx,
  action: string,
  entity: string,
  entityId: string | null,
  metadata: Json = {},
) {
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: admin.userId,
    action,
    entity,
    entity_id: entityId,
    metadata,
  });
  if (error) console.error("[audit]", error.message);
}

/** Postgres error codes surfaced by PostgREST. */
export const PG = { unique: "23505", foreignKey: "23503", check: "23514" } as const;
