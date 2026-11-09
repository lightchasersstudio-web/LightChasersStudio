import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Payroll → Employees against the DEV Supabase project. Needs an admin account
 * (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD). Employees can't be deleted in the
 * app, so the test removes its "E2E Staff …" rows with the service role when
 * SUPABASE_SERVICE_ROLE_KEY is set (else: npm run data:clean-tests).
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe.configure({ mode: "serial" });

// Unique per run: the desktop and phone projects run side by side.
const RUN = `E2E Staff ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
test.skip(!email || !password, "set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");

// 1×1 PNG, enough for the browser-side resize + upload pipeline.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.beforeEach(async ({ page }) => signIn(page));

test.afterAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await sb.from("employees").select("id, photo_path").like("full_name", `${RUN}%`);
  const ids = (data ?? []).map((e) => e.id);
  if (!ids.length) return;
  await sb.from("payslips").delete().in("employee_id", ids);
  await sb.from("employees").delete().in("id", ids);
  const photos = (data ?? []).flatMap((e) => (e.photo_path ? [e.photo_path] : []));
  if (photos.length) await sb.storage.from("employee-photos").remove(photos);
});

test("employees: add with photo, edit salary, deactivate and reactivate", async ({ page }) => {
  test.setTimeout(60_000);
  const name = `${RUN} Cruz`;

  await page.goto("/admin/employees/new");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Position").fill("Photographer");
  await page.getByLabel("Upload photo").setInputFiles({
    name: "me.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.getByRole("img", { name: "Employee photo" })).toBeVisible();
  await page.getByLabel("SSS no.").fill("34-123");
  await page.getByLabel("Monthly salary").fill("20000");
  await expect(page.getByText("₱10,000", { exact: true })).toBeVisible(); // per cut-off
  await expect(page.getByText("₱769.23", { exact: true })).toBeVisible(); // ÷ 26 days
  await page.getByRole("button", { name: "Add employee" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "The SSS no. has 10 digits, like 34-1234567-8." }),
  ).toBeVisible();

  await page.getByLabel("SSS no.").fill("3412345678");
  await page.getByRole("button", { name: "Add employee" }).click();
  await expect(page).toHaveURL(/\/admin\/employees\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByLabel("SSS no.")).toHaveValue("34-1234567-8");

  // Switch to a daily rate.
  await page.getByLabel("Paid by").selectOption("daily");
  await page.getByLabel("Daily rate").fill("650");
  await expect(page.getByText("₱16,900", { exact: true })).toBeVisible(); // × 26 days
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Employee saved.")).toBeVisible();

  // Benefits follow the new salary: ₱650 × 26 = ₱16,900 → SSS MSC ₱17,000.
  const benefitList = page.getByRole("list", { name: "Benefits" });
  const benefits = benefitList.getByRole("listitem").filter({ hasText: "SSS" });
  await expect(benefits).toContainText("₱425.00 per cut-off · ₱850.00 a month");
  await expect(benefits).toContainText("Monthly Salary Credit ₱17,000.00");
  const philhealth = benefitList.getByRole("listitem").filter({ hasText: "PhilHealth" });
  await expect(philhealth).toContainText("₱211.25 per cut-off");
  await philhealth.getByRole("switch", { name: "PhilHealth" }).click();
  await expect(page.getByText(`PhilHealth off for ${name}.`)).toBeVisible();
  await page.reload();
  await expect(benefitList.getByRole("listitem").filter({ hasText: "PhilHealth" })).toContainText(
    "Not enrolled",
  );

  // Rates page: a range that doesn't make sense isn't saved.
  await page.goto("/admin/payroll/settings");
  await expect(page.getByRole("row", { name: /SSS/ })).toContainText("₱500.00");
  await page.getByLabel("Salary ceiling").fill("5000");
  await page.getByRole("button", { name: "Save rates" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "The ceiling can't be lower than the floor." }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept()); // unsaved changes: leave anyway

  await page.goto("/admin/employees");
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("₱650");
  await expect(row).toContainText("a day");

  await row.getByRole("link").click();
  await page.getByRole("button", { name: "Deactivate" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByText(`${name} is now inactive.`)).toBeVisible();
  await expect(page.getByText("Inactive", { exact: true })).toBeVisible();

  await page.goto("/admin/employees");
  await expect(page.getByRole("listitem").filter({ hasText: name })).toHaveCount(0);
  await page.goto("/admin/employees?status=inactive");
  await page.getByRole("listitem").filter({ hasText: name }).getByRole("link").click();
  await page.getByRole("button", { name: "Reactivate" }).click();
  await expect(page.getByText(`${name} is active again.`)).toBeVisible();
});
