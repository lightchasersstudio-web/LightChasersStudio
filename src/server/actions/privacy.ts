"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import { anonymiseClientSchema, namesMatch } from "@/lib/validations/privacy";
import { adminAction, audit, revalidate, TAGS } from "@/server/admin-action";

const STUDENT_IDS = "student-ids";

/** Deletes student-ID photos the database just let go of; a failure only leaves files behind. */
async function removeStudentIds(paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await createAdminClient().storage.from(STUDENT_IDS).remove(paths);
  if (error) console.error("[privacy] remove student IDs", paths, error);
}

/**
 * Owner only: delete a client's personal data on request (RA 10173). Names and
 * contact details go; amounts, dates and references stay for the accounts.
 */
export async function anonymiseClient(input: unknown): Promise<ActionResult> {
  return adminAction(anonymiseClientSchema, input, async ({ id, confirmName }, ctx) => {
    if (ctx.admin.role !== "owner") return fail("Only the owner can delete a client's data.");
    const { data: client, error } = await ctx.supabase
      .from("clients")
      .select("full_name")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!client) return fail("Client not found.");
    if (!namesMatch(confirmName, client.full_name)) {
      return fail("The name doesn't match.", {
        confirmName: ["Type the client's name exactly as shown."],
      });
    }

    const { data, error: rpcError } = await createAdminClient().rpc("anonymise_client", {
      p_client_id: id,
    });
    if (rpcError) {
      if (rpcError.message.includes("client_has_upcoming_booking")) {
        return fail(
          "This client has an upcoming booking. Cancel or complete it first, then delete their data.",
        );
      }
      if (rpcError.message.includes("client_not_found")) return fail("Client not found.");
      throw rpcError;
    }
    await removeStudentIds((data ?? []).map((r) => r.student_id_path));
    // No name in the log: the point is to forget it.
    await audit(ctx, "client.anonymise", "client", id);
    revalidate(TAGS.bookings);
    return ok(undefined);
  });
}

/** Deletes the student ID photos of workshops that have ended. */
export async function clearPastStudentIds(
  input: unknown,
): Promise<ActionResult<{ deleted: number }>> {
  return adminAction(z.object({}), input, async (_, ctx) => {
    const { data, error } = await createAdminClient().rpc("clear_past_student_ids");
    if (error) throw error;
    const paths = (data ?? []).map((r) => r.student_id_path);
    await removeStudentIds(paths);
    await audit(ctx, "service.student_ids_deleted", "service", null, { count: paths.length });
    revalidate(TAGS.bookings);
    return ok({ deleted: paths.length });
  });
}
