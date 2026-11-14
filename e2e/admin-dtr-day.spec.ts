import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * The Payroll page (the whole team on one date, payslips saved with the day),
 * old Time record links and the grouped menu, against the DEV Supabase project.
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
  // Saving a day saved this test cut-off's payroll (2024 is a test-only year).
  await sb.from("payroll_periods").delete().eq("period_start", CUTOFF);
});

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** A person's row on the day sheet (the payslip list below has their name too). */
const dayRow = (page: Page, name: string) => page.locator("form li").filter({ hasText: name });

test("payroll: one day for the whole team, saving only what changed", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page);
  await page.goto(`/admin/payroll?date=${DATE}`);
  await page.waitForLoadState("networkidle"); // let React hydrate before changing the form
  // 2024 is a finished cut-off: saving asks first (see the next test).
  page.on("dialog", (d) => void d.accept());

  // AM fills its usual times (shown in the row; "Edit" opens them); absent has none.
  await page.getByLabel(`Status, ${ANA}`).selectOption("am");
  await expect(dayRow(page, ANA)).toContainText("9:30 AM – 5:30 PM");
  await dayRow(page, ANA)
    .getByRole("button", { name: /Edit times and note/ })
    .click();
  await expect(dayRow(page, ANA).getByLabel("Time in", { exact: true })).toHaveValue("09:30");
  await page.getByLabel(`Status, ${BEN}`).selectOption("absent");
  await dayRow(page, BEN)
    .getByRole("button", { name: /Edit times and note/ })
    .click();
  await dayRow(page, BEN).getByLabel("Note", { exact: true }).fill("Sick");
  await expect(page.getByText("2 changes")).toBeVisible();

  await page.getByRole("button", { name: "Save day" }).click();
  await expect(page.getByText(/saved\. Payslips are updated\./)).toBeVisible();

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

  // One save: the cut-off's payslips were saved too, and are listed below the day.
  const { data: slip } = await admin()
    .from("payslips")
    .select("days_present, gross_pay, payroll_period:payroll_periods!inner(period_start)")
    .eq("employee_id", ids[ANA]!)
    .eq("payroll_period.period_start", CUTOFF)
    .single();
  expect(slip).toMatchObject({ days_present: 1, gross_pay: 650 });
  const payslips = page.getByRole("list", { name: "Payslips" });
  await expect(payslips.getByRole("listitem").filter({ hasText: ANA })).toContainText("₱650.00");

  await page.reload();
  await expect(page.getByLabel(`Status, ${ANA}`)).toHaveValue("am");
  await expect(dayRow(page, BEN)).toContainText("Sick");

  // Setting a row back to "Not set" removes it.
  await page.waitForLoadState("networkidle");
  await page.getByLabel(`Status, ${BEN}`).selectOption({ label: "Not set" });
  await page.getByRole("button", { name: "Save day" }).click();
  await expect(page.getByText(/saved\. Payslips are updated\./)).toBeVisible();
  const { count } = await admin()
    .from("attendance_logs")
    .select("employee_id", { count: "exact", head: true })
    .eq("work_date", DATE)
    .in("employee_id", Object.values(ids));
  expect(count).toBe(1);
});

test("a past cut-off: warns first, then redoes only the edited person's payslip", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const sb = admin();
  const payslipOf = async (id: string) =>
    (
      await sb
        .from("payslips")
        .select("net_pay, payroll_period:payroll_periods!inner(period_start)")
        .eq("employee_id", id)
        .eq("payroll_period.period_start", CUTOFF)
        .maybeSingle()
    ).data;
  // Ben has a saved payslip in this (2024, so finished) cut-off from the test above.
  expect(await payslipOf(ids[BEN]!)).not.toBeNull();
  const anaBefore = Number((await payslipOf(ids[ANA]!))!.net_pay);
  // Since then Ben left (deactivated): he's no longer on the day sheet.
  await sb.from("employees").update({ is_active: false }).eq("id", ids[BEN]!);

  await signIn(page);
  await page.goto(`/admin/payroll?date=${DATE}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel(`Status, ${ANA}`).selectOption("absent");

  // Saving asks first, naming whose payslip changes; saying no saves nothing.
  const warnings: string[] = [];
  page.once("dialog", (d) => {
    warnings.push(d.message());
    void d.dismiss();
  });
  await page.getByRole("button", { name: "Save day" }).click();
  await expect.poll(() => warnings.length).toBe(1);
  expect(warnings[0]).toContain(`already over and paid. Saving changes the payslip of ${ANA}.`);
  const { data: before } = await sb
    .from("attendance_logs")
    .select("status")
    .eq("employee_id", ids[ANA]!)
    .eq("work_date", DATE)
    .single();
  expect(before!.status).toBe("am");

  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Save day" }).click();
  await expect(page.getByText(/saved\. Payslips are updated\./)).toBeVisible({ timeout: 15_000 });

  // Ana's payslip is redone without her ₱650 day; Ben keeps his saved payslip
  // although he's no longer active.
  expect(Number((await payslipOf(ids[ANA]!))!.net_pay)).toBe(anaBefore - 650);
  expect(await payslipOf(ids[BEN]!)).not.toBeNull();
});

test("old Time record → By day links open the Payroll page", async ({ page }) => {
  await signIn(page);
  await page.goto(`/admin/dtr/day?date=${DATE}`);
  await expect(page).toHaveURL(new RegExp(`/admin/payroll\\?date=${DATE}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Payroll" })).toBeVisible();
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
    "Payroll",
  ]);
});
