import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Payroll → Time record against the DEV Supabase project. Needs an admin
 * account (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD) and the service role key
 * (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) to add and remove its
 * test employee.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe.configure({ mode: "serial" });
test.skip(!email || !password || !url || !key, "needs admin login and the service role key");

const RUN = `E2E Staff ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const NAME = `${RUN} Reyes`;
// Nov 1–15, 2026: the 1st, 8th and 15th are Sundays.
const CUTOFF = "2026-11-01";
let employeeId = "";

const admin = () => createClient(url!, key!, { auth: { persistSession: false } });

test.beforeAll(async () => {
  const { data, error } = await admin()
    .from("employees")
    .insert({
      full_name: NAME,
      position: "Assistant",
      category: "studio",
      date_hired: "2026-01-05",
      salary_type: "daily",
      salary_rate: 650,
    })
    .select("id")
    .single();
  if (error) throw error;
  employeeId = data.id;
});

test.afterAll(async () => {
  const sb = admin();
  const { data } = await sb.from("employees").select("id").like("full_name", `${RUN}%`);
  const ids = (data ?? []).map((e) => e.id);
  if (ids.length) {
    await sb.from("payslips").delete().in("employee_id", ids);
    await sb.from("employees").delete().in("id", ids);
  }
});

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("time record: fill a cut-off, mark an absence, overnight shift, totals", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  // Phones show a card per person instead of the overview table.
  const phone = testInfo.project.name === "mobile";
  const entry = () =>
    (phone
      ? page.getByRole("list", { name: "Time records" }).getByRole("listitem")
      : page.getByRole("row")
    ).filter({ hasText: NAME });
  await signIn(page);
  await page.goto(`/admin/dtr?cutoff=${CUTOFF}`);
  await expect(page.getByText("Nov 1–15, 2026", { exact: true })).toBeVisible();
  await expect(entry()).toContainText("0/15");
  await (
    phone
      ? entry().getByRole("link")
      : entry().getByRole("link", { name: `Open ${NAME}'s time record` })
  ).click();
  await expect(page.getByRole("heading", { level: 2, name: NAME })).toBeVisible();

  await page.getByLabel("Usual time in").fill("08:00");
  await page.getByLabel("Usual time out").fill("17:00");
  await expect(page.getByLabel("Day off")).toHaveValue("0"); // Sunday
  await page.getByRole("button", { name: "Fill blank days" }).click();
  await expect(
    page.getByText("Filled 12 work days and 3 rest days. Save to keep them."),
  ).toBeVisible();
  await expect(page.getByLabel("Status, Sun 1 Nov")).toHaveValue("rest_day");

  await page.getByLabel("Status, Tue 3 Nov").selectOption("absent");
  await expect(page.getByLabel("Time in, Tue 3 Nov")).toBeDisabled();
  await page.getByLabel("Note, Tue 3 Nov").fill("Sick");

  // An overnight event shoot: 6 PM to 1 AM = 7 hours.
  await page.getByLabel("Time out, Wed 4 Nov").fill("");
  await page.getByRole("button", { name: "Save time record" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter the time out." })).toBeVisible();
  await page.getByLabel("Time in, Wed 4 Nov").fill("18:00");
  await page.getByLabel("Time out, Wed 4 Nov").fill("01:00");

  // 10 days × 9h + 7h = 97h
  const totals = page.locator("tfoot");
  await expect(totals).toContainText("Present11");
  await expect(totals).toContainText("Absent1");
  await expect(totals).toContainText("Hours worked97h");
  // Against an 8-hour shift: 10 days of 9 h = 10 h overtime; the 7-hour night = 1 h short.
  await expect(totals).toContainText("Short1h");
  await expect(totals).toContainText("Overtime10h");
  await expect(page.getByRole("row", { name: /Mon 2 Nov/ })).toContainText("1h overtime");

  await page.getByRole("button", { name: "Save time record" }).click();
  await expect(page.getByText(`Time record saved for ${NAME}.`)).toBeVisible();

  await page.reload();
  await page.waitForLoadState("networkidle"); // let React hydrate before changing the form
  await expect(page.getByLabel("Status, Tue 3 Nov")).toHaveValue("absent");
  await expect(page.getByLabel("Note, Tue 3 Nov")).toHaveValue("Sick");
  await expect(page.getByLabel("Time out, Wed 4 Nov")).toHaveValue("01:00");

  // Clearing a day removes it.
  await page.getByLabel("Status, Sat 14 Nov").selectOption({ label: "Not recorded" });
  await page.getByRole("button", { name: "Save time record" }).click();
  await expect(page.getByText(`Time record saved for ${NAME}.`)).toBeVisible();

  await page.getByRole("link", { name: "All staff" }).click();
  const row = entry();
  await expect(row).toContainText("14/15");
  await expect(row).toContainText("88h");

  const { data } = await admin()
    .from("attendance_logs")
    .select("work_date, minutes_worked")
    .eq("employee_id", employeeId)
    .eq("work_date", "2026-11-04")
    .single();
  expect(data?.minutes_worked).toBe(420);

  // Deactivated staff leave the time record (their days are kept).
  await admin().from("employees").update({ is_active: false }).eq("id", employeeId);
  await page.reload();
  await expect(page.getByText("Nov 1–15, 2026", { exact: true })).toBeVisible();
  await expect(entry()).toHaveCount(0);
  const { count } = await admin()
    .from("attendance_logs")
    .select("work_date", { count: "exact", head: true })
    .eq("employee_id", employeeId);
  expect(count).toBe(14);
});

test("time record: Save & next goes through the team", async ({ page }) => {
  test.setTimeout(60_000);
  const NEXT = `${RUN} Santos`; // sorts right after NAME
  await admin().from("employees").update({ is_active: true }).eq("id", employeeId);
  const { data: added, error } = await admin()
    .from("employees")
    .insert({
      full_name: NEXT,
      position: "Assistant",
      category: "studio",
      date_hired: "2026-01-05",
      salary_type: "daily",
      salary_rate: 650,
    })
    .select("id")
    .single();
  if (error) throw error;

  await signIn(page);
  await page.goto(`/admin/dtr?cutoff=${CUTOFF}&employee=${employeeId}`);
  await expect(page.getByRole("link", { name: "Payroll" }).last()).toHaveAttribute(
    "href",
    "/admin/payroll",
  );
  await page.waitForLoadState("networkidle"); // let React hydrate before changing the form

  // Nothing changed: a plain link to the next person.
  await expect(page.getByRole("link", { name: `Next: ${NEXT}` })).toBeVisible();

  await page.getByLabel("Note, Mon 2 Nov").fill("Studio day");
  await page.getByRole("button", { name: `Save & go to ${NEXT}` }).click();
  await expect(page.getByText(`Time record saved for ${NAME}.`)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`employee=${added.id}`));
  await expect(page.getByRole("heading", { level: 2, name: NEXT })).toBeVisible();
  await expect(page.getByRole("link", { name: `Previous: ${NAME}` })).toBeVisible();

  const { data } = await admin()
    .from("attendance_logs")
    .select("note")
    .eq("employee_id", employeeId)
    .eq("work_date", "2026-11-02")
    .single();
  expect(data?.note).toBe("Studio day");
});
