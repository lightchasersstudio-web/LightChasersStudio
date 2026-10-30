import "server-only";

import { ACTIVITY_KINDS, type ActivityKind } from "@/lib/admin/activity";
import { PAGE_SIZE, type ListFilters } from "@/lib/admin/list-filters";
import { createClient } from "@/lib/supabase/server";

export type ActivityEntry = {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: string;
  /** Booking reference, for booking entries whose booking still exists. */
  reference?: string;
};

/** One page of the audit log, newest first (RLS: admins only). */
export async function listActivity(
  filters: ListFilters,
): Promise<{ rows: ActivityEntry[]; total: number }> {
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("id, action, entity, entity_id, metadata, created_at, actor_id", { count: "exact" });
  if (filters.kind in ACTIVITY_KINDS) {
    query = query.in("entity", [...ACTIVITY_KINDS[filters.kind as ActivityKind].entities]);
  }
  const start = (filters.page - 1) * PAGE_SIZE;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(start, start + PAGE_SIZE - 1);
  if (error) throw error;

  const actorIds = [...new Set(data.map((r) => r.actor_id).filter((id): id is string => !!id))];
  const bookingIds = [
    ...new Set(data.filter((r) => r.entity === "booking" && r.entity_id).map((r) => r.entity_id!)),
  ];
  const [admins, bookings] = await Promise.all([
    actorIds.length
      ? supabase.from("admin_profiles").select("user_id, full_name").in("user_id", actorIds)
      : { data: [] },
    bookingIds.length
      ? supabase.from("bookings").select("id, reference_code").in("id", bookingIds)
      : { data: [] },
  ]);
  const names = new Map((admins.data ?? []).map((a) => [a.user_id, a.full_name]));
  const refs = new Map((bookings.data ?? []).map((b) => [b.id, b.reference_code]));

  return {
    rows: data.map((r) => ({
      id: r.id,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
      createdAt: r.created_at,
      actor: (r.actor_id && names.get(r.actor_id)) || "Staff",
      reference: r.entity_id ? refs.get(r.entity_id) : undefined,
    })),
    total: count ?? 0,
  };
}
