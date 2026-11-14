import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const STUDENT_IDS = "student-ids";

/** Deletes student-ID photos the database just let go of; a failure only leaves files behind. */
export async function removeStudentIds(paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await createAdminClient().storage.from(STUDENT_IDS).remove(paths);
  if (error) console.error("[privacy] remove student IDs", paths, error);
}

/**
 * Studio Policy 7.2: client details are deleted a set number of days after
 * their last booking date (Settings → Booking rules, default 7), unless a
 * booking is still open, a refund is being checked, a done booking still has a
 * balance (damage or extra charges) or a reschedule request is waiting. Names
 * and contact details go; amounts, dates, references and receipts stay (records
 * the law requires). Student ID photos go once their workshop is over.
 *
 * SERVICE ROLE: only the daily cron job calls this.
 */
export async function purgeExpiredPersonalData(): Promise<{
  clients: number;
  studentIds: number;
  failed: number;
}> {
  const supabase = createAdminClient();
  const { data: due, error } = await supabase.rpc("clients_past_retention");
  if (error) throw error;

  let clients = 0;
  let failed = 0;
  for (const id of due ?? []) {
    const { data, error: rpcError } = await supabase.rpc("anonymise_client", { p_client_id: id });
    if (rpcError) {
      failed++;
      console.error("[privacy] anonymise", id, rpcError.message);
      continue;
    }
    await removeStudentIds((data ?? []).map((r) => r.student_id_path));
    clients++;
  }

  const { data: ids, error: idsError } = await supabase.rpc("clear_past_student_ids");
  if (idsError) throw idsError;
  const paths = (ids ?? []).map((r) => r.student_id_path);
  await removeStudentIds(paths);

  // One line on the Activity page per run that deleted something (no names).
  if (clients > 0 || paths.length > 0) {
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_id: null,
      action: "privacy.auto_delete",
      entity: "client",
      entity_id: null,
      metadata: { clients, student_ids: paths.length },
    });
    if (auditError) console.error("[privacy] audit", auditError.message);
  }
  return { clients, studentIds: paths.length, failed };
}
