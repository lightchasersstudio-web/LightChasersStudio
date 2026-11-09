// Removes test data from the DEV database.
//
//   npm run data:clean-tests                 # E2E test rows only (safe to run anytime)
//   npm run data:clean-tests -- --all-bookings   # ALSO every booking, payment and client
//
// Packages, add-ons, photos, settings and admins are never touched.
// Refuses to run against anything but the dev project, so live data is safe.
import { createClient } from "@supabase/supabase-js";

const DEV_PROJECT_REF = "mkpjxrhjynbjuiovloiy";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const allBookings = process.argv.includes("--all-bookings");

if (!url.includes(DEV_PROJECT_REF) || !key) {
  console.error(
    `Refusing: this only runs against the dev project (${DEV_PROJECT_REF}). ` +
      "Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const fail = (what, error) => {
  console.error(`${what} failed:`, error.message);
  process.exit(1);
};

/** Deletes bookings (payments first; booking_add_ons cascade) and clients left with none. */
async function deleteBookings(query) {
  const { data, error } = await query;
  if (error) fail("Finding bookings", error);
  if (!data.length) return 0;
  const ids = data.map((b) => b.id);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const p = await sb.from("payments").delete().in("booking_id", chunk);
    if (p.error) fail("Deleting payments", p.error);
    const b = await sb.from("bookings").delete().in("id", chunk);
    if (b.error) fail("Deleting bookings", b.error);
  }
  const clientIds = [...new Set(data.map((b) => b.client_id))];
  const { data: still } = await sb.from("bookings").select("client_id").in("client_id", clientIds);
  const orphans = clientIds.filter((c) => !still?.some((r) => r.client_id === c));
  if (orphans.length) await sb.from("clients").delete().in("id", orphans);
  return ids.length;
}

const removed = {
  bookings: await deleteBookings(
    allBookings
      ? sb.from("bookings").select("id, client_id")
      : sb.from("bookings").select("id, client_id").like("contact_name", "E2E Client%"),
  ),
};

const services = await sb.from("services").delete().like("name", "E2E Package%").select("id");
removed.packages = services.data?.length ?? 0;
const photos = await sb
  .from("portfolio_images")
  .delete()
  .like("alt_text", "E2E photo%")
  .select("storage_path");
if (photos.data?.length) {
  await sb.storage.from("portfolio").remove(photos.data.map((p) => p.storage_path));
}
removed.photos = photos.data?.length ?? 0;
const blackouts = await sb
  .from("blackout_dates")
  .delete()
  .like("reason", "E2E test%")
  .select("date");
removed.blackouts = blackouts.data?.length ?? 0;
// Payroll: E2E staff, their payslips (time records go with them), and photos.
const e2eStaff = await sb
  .from("employees")
  .select("id, photo_path")
  .like("full_name", "E2E Staff%");
const staffIds = (e2eStaff.data ?? []).map((e) => e.id);
if (staffIds.length) {
  await sb.from("payslips").delete().in("employee_id", staffIds);
  await sb.from("employees").delete().in("id", staffIds);
  const staffPhotos = (e2eStaff.data ?? []).flatMap((e) => (e.photo_path ? [e.photo_path] : []));
  if (staffPhotos.length) await sb.storage.from("employee-photos").remove(staffPhotos);
}
removed.employees = staffIds.length;
// The payroll E2E test saves its payrolls in 2031 cut-offs.
const e2ePayrolls = await sb
  .from("payroll_periods")
  .delete()
  .gte("period_start", "2031-01-01")
  .lt("period_start", "2032-01-01")
  .select("id");
removed.payrolls = e2ePayrolls.data?.length ?? 0;
// Test runs book from one computer and trip the 5-per-10-minutes limit; reset it.
const limits = await sb.from("rate_limits").delete().neq("key", "").select("key");
removed.rateLimitCounters = limits.data?.length ?? 0;

console.log(
  allBookings ? "Removed ALL bookings (dev) and E2E test data:" : "Removed E2E test data:",
);
console.table(removed);
