import "server-only";

import { currentCutoff, cutoffLabel, shiftCutoff } from "@/lib/payroll/cutoff";
import { createClient } from "@/lib/supabase/server";
import { getPayrollFlow } from "@/server/queries/payroll-flow";

/** Bookings that still matter: a request on a cancelled booking is no longer a to-do. */
const CLOSED = "(cancelled,declined,expired)";

export type AdminTask = {
  kind: "reschedule" | "student_id" | "payroll";
  title: string;
  detail: string;
  href: string;
};

/**
 * Things waiting on an admin that live outside the booking list: client
 * reschedule requests, student IDs to accept or reject, and the last cut-off's
 * payroll when it isn't saved or is out of date.
 */
export async function getAdminTasks(now: Date = new Date()): Promise<AdminTask[]> {
  const supabase = await createClient();
  const lastCutoff = shiftCutoff(currentCutoff(now), -1);
  const [requests, students, payroll] = await Promise.all([
    supabase
      .from("booking_requests")
      .select("id, created_at, booking:bookings!inner(id, reference_code, contact_name, status)")
      .eq("status", "open")
      .not("booking.status", "in", CLOSED)
      .order("created_at")
      .limit(10),
    supabase
      .from("booking_attendees")
      .select("id, full_name, booking:bookings!inner(id, reference_code, status)")
      .eq("id_status", "pending")
      .not("student_id_path", "is", null)
      .not("booking.status", "in", CLOSED)
      .order("created_at")
      .limit(10),
    getPayrollFlow(lastCutoff),
  ]);
  if (requests.error) throw requests.error;
  if (students.error) throw students.error;

  const tasks: AdminTask[] = [];
  const { flow } = payroll;
  if (flow.staff > 0 && (flow.savedAt === null || flow.changed)) {
    tasks.push({
      kind: "payroll",
      title:
        flow.savedAt === null
          ? `Payroll for ${cutoffLabel(lastCutoff)} isn't saved yet`
          : `Payroll for ${cutoffLabel(lastCutoff)} is out of date`,
      detail:
        flow.savedAt === null
          ? `${flow.staffComplete} of ${flow.staff} staff have every day filled in`
          : "Days or pay changed after it was saved. Save it again.",
      href: `/admin/payroll?cutoff=${lastCutoff.start}${flow.changed ? "&view=preview" : ""}`,
    });
  }
  for (const r of requests.data) {
    tasks.push({
      kind: "reschedule",
      title: `${r.booking.contact_name} asked to reschedule`,
      detail: r.booking.reference_code,
      href: `/admin/bookings/${r.booking.id}`,
    });
  }
  for (const s of students.data) {
    tasks.push({
      kind: "student_id",
      title: `Check ${s.full_name}'s student ID`,
      detail: `Workshop · ${s.booking.reference_code}`,
      href: `/admin/bookings/${s.booking.id}`,
    });
  }
  return tasks;
}
