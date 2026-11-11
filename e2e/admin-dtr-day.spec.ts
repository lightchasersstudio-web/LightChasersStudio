import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Time record → By day (the whole team on one date), the Payroll page's
 * blank-day warning and the grouped menu, against the DEV Supabase project.
 * Needs E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD and the service role key.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe.configure({ mode: "serial" });
test.skip(!email || !password || !url || !key, "needs admin login and the service role key");

const RUN = `E2E Day ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ANA = `${RUN} Ana`;
const BEN = `${RUN} Ben`;
// A random past day (2–14) in 2024, so the blank-day warning applies and no real records clash.
const MONTH = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
const DAY = String(2 + Math.floor(Math.random() * 13)).padStart(2, "0");
const DATE = `2024-${MONTH}-${DAY}`;
const CUTOFF = `2024-${MONTH}-01`;
const ids: Record<string, string> = {};

const admin = () => createClient(url!, key!, { auth: { persistSession: false } });

test.beforeAll(async () => {
  const { data, error } = await admin()
    .from("employees")
    .insert(
      [ANA, BEN].map((full_name) => ({
        full_name,
        position: "Assistant",
        category: "studio",
        date_hired: "2024-01-01",
        salary_type: "daily",
        salary_rate: 650,
      })),
    )
    .select("id, full_name");
  if (error) throw error;
  for (const e of data) ids[e.full_name] = e.id;
});

test.afterAll(async () => {
  const sb = admin();
  const { data } = await sb.from("employees").select("id").like("full_name", `${RUN}%`);
  const list = (data ?? []).map((e) => e.id);
  if (list.length) {
    await sb.from("attendance_logs").delete().in("employee_id", list);
    await sb.from("payslips").delete().in("employee_id", list);
    await sb.from("employees").delete().in("id", list);
  }
});

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("by day: the whole team on one date, saving only what changed", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page);
  await page.goto(`/admin/dtr/day?date=${DATE}`);
  await expect(
    page.getByRole("navigation", { name: "Time record view" }).getByRole("link", {
      name: /By day/,
    }),
  ).toHaveAttribute("aria-current", "page");
  await page.waitForLoadState("networkidle"); // let React hydrate before changing the form

  // AM fills its usual times; absent has none.
  await page.getByLabel(`Status, ${ANA}`).selectOption("am");
  await expect(page.getByLabel(`Time in, ${ANA}`)).toHaveValue("09:30");
  await expect(page.getByLabel(`Time out, ${ANA}`)).toHaveValue("17:30");
  await page.getByLabel(`Status, ${BEN}`).selectOption("absent");
  await page.getByLabel(`Note, ${BEN}`).fill("Sick");
  await expect(page.getByText("2 changes")).toBeVisible();

  await page.getByRole("button", { name: "Save day" }).click();
  await expect(page.getByText(/Time record saved for/)).toBeVisible();

  // Only the two changed rows were written: real staff on the list are untouched.
  const { data } = await admin()
    .from("attendance_logs")
    .select("employee_id, status, time_in, daily_rate, note")
    .eq("work_date", DATE)
    .in("employee_id", Object.values(ids));
  expect(data).toHaveLength(2);
  const { count: others } = await admin()
    .from("attendance_logs")
    .select("employee_id, employee:employees!inner(full_name)", { count: "exact", head: true })
    .eq("work_date", DATE)
    .not("employee.full_name", "like", "E2E%");
  expect(others).toBe(0);
  const ana = data!.find((r) => r.employee_id === ids[ANA]);
  expect(ana).toMatchObject({ status: "am", time_in: "09:30:00", daily_rate: 650 });
  expect(data!.find((r) => r.employee_id === ids[BEN])).toMatchObject({
    status: "absent",
    note: "Sick",
  });

  await page.reload();
  await expect(page.getByLabel(`Status, ${ANA}`)).toHaveValue("am");
  await expect(page.getByLabel(`Note, ${BEN}`)).toHaveValue("Sick");

  // Setting a row back to "Not recorded" removes it.
  await page.waitForLoadState("networkidle");
  await page.getByLabel(`Status, ${BEN}`).selectOption({ label: "Not recorded" });
  await page.getByRole("button", { name: "Save day" }).click();
  await expect(page.getByText(/Time record saved for/)).toBeVisible();
  const { count } = await admin()
    .from("attendance_logs")
    .select("employee_id", { count: "exact", head: true })
    .eq("work_date", DATE)
    .in("employee_id", Object.values(ids));
  expect(count).toBe(1);
});

test("payroll: warns about blank days before saving", async ({ page }) => {
  await signIn(page);
  await page.goto(`/admin/payroll?cutoff=${CUTOFF}`);
  const blank = page.getByRole("region", { name: "Some days on the time record are blank" });
  await expect(blank).toBeVisible();
  // Ana has one day recorded, so 14 of the cut-off's 15 days are blank.
  await expect(blank.getByRole("listitem").filter({ hasText: ANA })).toContainText("14 days");
  await expect(blank.getByRole("link", { name: `Fill in ${ANA}'s days` })).toHaveAttribute(
    "href",
    `/admin/dtr?cutoff=${CUTOFF}&employee=${ids[ANA]}`,
  );

  await page.getByRole("button", { name: /^Save (payroll|again)$/ }).click();
  await expect(page.getByRole("alertdialog")).toContainText(/still blank/);
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("menu: grouped into Bookings, Team, Website and Admin", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "the phone menu is the same list in a sheet");
  await signIn(page);
  const nav = page.getByRole("navigation", { name: "Admin" });
  for (const group of ["Bookings", "Team", "Website", "Admin"]) {
    await expect(nav.getByRole("group", { name: group })).toBeVisible();
  }
  await expect(nav.getByRole("group", { name: "Team" }).getByRole("link")).toHaveText([
    "Employees",
    "Time record",
    "Payroll",
  ]);
});
