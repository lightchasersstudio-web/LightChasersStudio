import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Bookings that still matter: a request on a cancelled booking is no longer a to-do. */
const CLOSED = "(cancelled,declined,expired)";

export type AdminTask = {
  kind: "reschedule" | "student_id";
  title: string;
  detail: string;
  href: string;
};

/**
 * Things waiting on an admin that live outside the booking list: client
 * reschedule requests and student IDs to accept or reject. (Payroll saves by
 * itself when days are saved, so it never waits here.)
 */
export async function getAdminTasks(): Promise<AdminTask[]> {
  const supabase = await createClient();
  const [requests, students] = await Promise.all([
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
  ]);
  if (requests.error) throw requests.error;
  if (students.error) throw students.error;

  const tasks: AdminTask[] = [];
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
