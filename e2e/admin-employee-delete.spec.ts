import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Employees → Delete / Deleted / Restore and the History section, against the
 * DEV Supabase project. Needs an admin account and the service role key.
 * Its payroll is saved in a random 2040s cut-off so it never touches others.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe.configure({ mode: "serial" });
test.skip(!email || !password || !url || !key, "needs admin login and the service role key");

const RUN = `E2E Staff ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const NAME = `${RUN} Gina`;
const MONTH = `${2040 + Math.floor(Math.random() * 10)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}`;
const CUTOFF = `${MONTH}-01`;
const AM_DAY = `${MONTH}-03`;
let employeeId = "";
let periodId = "";

const admin = () => createClient(url!, key!, { auth: { persistSession: false } });

test.beforeAll(async () => {
  const sb = admin();
  const { data, error } = await sb
    .from("employees")
    .insert({
      full_name: NAME,
      position: "Booth crew",
      date_hired: "2026-01-05",
      category: "photobooth",
      salary_type: "daily",
      salary_rate: 650,
    })
    .select("id")
    .single();
  if (error) throw error;
  employeeId = data.id;

  const { error: logError } = await sb.from("attendance_logs").insert([
    {
      employee_id: employeeId,
      work_date: AM_DAY,
      status: "am",
      time_in: "08:00",
      time_out: "16:00",
    },
    { employee_id: employeeId, work_date: `${MONTH}-04`, status: "rest_day" },
  ]);
  if (logError) throw logError;

  const { data: period, error: periodError } = await sb
    .from("payroll_periods")
    .insert({ period_start: CUTOFF, period_end: `${MONTH}-15` })
    .select("id")
    .single();
  if (periodError) throw periodError;
  periodId = period.id;
  const { error: slipError } = await sb.from("payslips").insert({
    payroll_period_id: periodId,
    employee_id: employeeId,
    employee_name: NAME,
    employee_position: "Booth crew",
    salary_type: "daily",
    salary_rate: 650,
    daily_rate: 650,
    monthly_salary: 19500,
    days_present: 1,
    basic_pay: 650,
    gross_pay: 650,
    total_deductions: 0,
    net_pay: 650,
  });
  if (slipError) throw slipError;
});

test.afterAll(async () => {
  const sb = admin();
  if (periodId) await sb.from("payroll_periods").delete().eq("id", periodId);
  if (!employeeId) return;
  // The payroll spec, running alongside, may have given them payslips too.
  await sb.from("payslips").delete().eq("employee_id", employeeId);
  const { error } = await sb.from("employees").delete().eq("id", employeeId);
  if (error) throw error;
});

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("history, delete (records kept), deleted list, restore", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page);

  // History on the employee page: the saved payslip and both days.
  await page.goto(`/admin/employees/${employeeId}`);
  const history = page.locator("section", { has: page.getByRole("heading", { name: "History" }) });
  await expect(history).toContainText("1 saved payslip, ₱650.00 net in all.");
  await expect(history.getByRole("link", { name: "Payslip" })).toHaveAttribute(
    "href",
    `/admin/payroll/pdf?cutoff=${CUTOFF}&employee=${employeeId}`,
  );
  await expect(history).toContainText("2 recorded days.");
  await expect(history.getByRole("row").filter({ hasText: "AM shift" })).toContainText("₱650.00");
  await expect(history.getByRole("row").filter({ hasText: "Rest day" })).toContainText("₱0.00");

  // Delete (asks first).
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "Their past shifts and payslips are kept",
  );
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/admin\/employees$/);
  await expect(page.getByRole("link", { name: new RegExp(NAME) })).toHaveCount(0);

  // Gone from the time record and the daily payroll; records still in the DB.
  await page.goto(`/admin/dtr?cutoff=${CUTOFF}`);
  await expect(page.getByRole("link", { name: new RegExp(NAME) })).toHaveCount(0);
  await page.goto(`/admin/reports?payDate=${AM_DAY}#payroll`);
  await expect(page.locator("section#payroll")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: NAME })).toHaveCount(0);
  const { count } = await admin()
    .from("attendance_logs")
    .select("work_date", { count: "exact", head: true })
    .eq("employee_id", employeeId);
  expect(count).toBe(2);

  // Employees → Deleted: read-only page with the history and Restore.
  await page.goto("/admin/employees?status=deleted");
  await page.getByRole("link", { name: new RegExp(NAME) }).click();
  await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
  await expect(page.getByText("Deleted", { exact: true })).toBeVisible();
  await expect(history).toContainText("₱650.00 net in all.");
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);

  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText(`${NAME} is back as an active employee.`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  await page.goto("/admin/employees");
  await expect(page.getByRole("link", { name: new RegExp(NAME) })).toBeVisible();
});
