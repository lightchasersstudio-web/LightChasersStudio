import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { addDays, format } from "date-fns";

/**
 * Time record AM / PM / rest day + Sales report → Payroll, against the DEV
 * Supabase project. Needs an admin account (E2E_ADMIN_EMAIL /
 * E2E_ADMIN_PASSWORD) and the service role key to add and remove its staff.
 *
 * The sample day from the owner's request, one person per category:
 *   Studio      Bea    AM shift, daily ₱650               → ₱650.00
 *   Events      Carlo  PM shift 6 PM–2 AM, ₱24,015/month  → ₱800.50 (÷ 30)
 *   Photobooth  Dina   rest day                           → ₱0.00
 *   Total ₱1,450.50, 2 paid.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe.configure({ mode: "serial" });
test.skip(!email || !password || !url || !key, "needs admin login and the service role key");

const RUN = `E2E Staff ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
// A random day in 2033 per run (other specs use 2031), so parallel runs (desktop + phone) never share a day.
const DAY = format(addDays(new Date(2033, 0, 6), Math.floor(Math.random() * 300)), "yyyy-MM-dd");
const DAY_LABEL = format(new Date(`${DAY}T00:00:00`), "EEE d MMM");
const CUTOFF = `${DAY.slice(0, 8)}${Number(DAY.slice(8)) <= 15 ? "01" : "16"}`;
// Another day in the same cut-off, for the AM/PM shift.
const OTHER = format(
  addDays(new Date(`${DAY}T00:00:00`), ["01", "16"].includes(DAY.slice(8)) ? 1 : -1),
  "yyyy-MM-dd",
);
const OTHER_LABEL = format(new Date(`${OTHER}T00:00:00`), "EEE d MMM");
const STAFF = {
  bea: { name: `${RUN} Bea`, category: "studio", salary_type: "daily", salary_rate: 650 },
  carlo: { name: `${RUN} Carlo`, category: "events", salary_type: "monthly", salary_rate: 24015 },
  dina: { name: `${RUN} Dina`, category: "photobooth", salary_type: "daily", salary_rate: 700 },
} as const;
const ids: Record<keyof typeof STAFF, string> = { bea: "", carlo: "", dina: "" };

const admin = () => createClient(url!, key!, { auth: { persistSession: false } });

test.beforeAll(async () => {
  for (const [k, s] of Object.entries(STAFF) as [keyof typeof STAFF, (typeof STAFF)["bea"]][]) {
    const { data, error } = await admin()
      .from("employees")
      .insert({
        full_name: s.name,
        position: "Crew",
        date_hired: "2026-01-05",
        category: s.category,
        salary_type: s.salary_type,
        salary_rate: s.salary_rate,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids[k] = data.id;
  }
});

test.afterAll(async () => {
  const list = Object.values(ids).filter(Boolean);
  if (!list.length) return;
  const sb = admin();
  // The payroll spec, running alongside, may have given them payslips.
  await sb.from("payslips").delete().in("employee_id", list);
  const { error } = await sb.from("employees").delete().in("id", list);
  if (error) throw error;
});

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function openSheet(page: Page, who: keyof typeof STAFF) {
  await page.goto(`/admin/dtr?cutoff=${CUTOFF}&employee=${ids[who]}`);
  await expect(page.getByRole("heading", { level: 2, name: STAFF[who].name })).toBeVisible();
  await page.waitForLoadState("networkidle"); // let React hydrate before changing the form
}

async function save(page: Page, who: keyof typeof STAFF) {
  await page.getByRole("button", { name: "Save time record" }).click();
  await expect(page.getByText(`Time record saved for ${STAFF[who].name}.`)).toBeVisible();
}

test("AM/PM shifts fill the time out; the daily payroll adds up the day", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page);
  const status = () => page.getByLabel(`Status, ${DAY_LABEL}`);
  const timeIn = () => page.getByLabel(`Time in, ${DAY_LABEL}`);
  const timeOut = () => page.getByLabel(`Time out, ${DAY_LABEL}`);

  // Bea: AM → 9:30 AM to 5:30 PM, at her ₱650.
  await openSheet(page, "bea");
  await status().selectOption("am");
  await expect(timeIn()).toHaveValue("09:30");
  await expect(timeOut()).toHaveValue("17:30");
  await expect(page.getByLabel(`Daily rate, ${DAY_LABEL}`)).toHaveValue("650");
  await save(page, "bea");

  // Carlo: PM fills 2 PM–10 PM, even over times the day already had;
  // starting at 6 PM ends at 2 AM the next day.
  await openSheet(page, "carlo");
  await status().selectOption("present");
  await timeIn().fill("09:00");
  await timeOut().fill("17:00");
  await status().selectOption("pm");
  await expect(timeIn()).toHaveValue("14:00");
  await expect(timeOut()).toHaveValue("22:00");
  await timeIn().fill("18:00");
  await expect(timeOut()).toHaveValue("02:00");
  await expect(page.getByLabel(`Daily rate, ${DAY_LABEL}`)).toHaveValue("800.50");
  await save(page, "carlo");

  // Dina: rest day, no times.
  await openSheet(page, "dina");
  await status().selectOption("rest_day");
  await expect(timeIn()).toBeDisabled();
  await save(page, "dina");

  // Bea left at 3 PM: the time out stays editable and is marked.
  await openSheet(page, "bea");
  await timeOut().fill("15:00");
  await expect(page.getByText("Edited (not the usual times)")).toBeVisible();
  await save(page, "bea");

  // Carlo works both shifts another day: AM/PM fills 9:30 AM–10:00 PM and the
  // ₱650 AM/PM rate; another shift puts his own rate back; the rate stays editable.
  await openSheet(page, "carlo");
  const other = (f: string) => page.getByLabel(`${f}, ${OTHER_LABEL}`);
  await other("Status").selectOption("am_pm");
  await expect(other("Time in")).toHaveValue("09:30");
  await expect(other("Time out")).toHaveValue("22:00");
  await expect(other("Daily rate")).toHaveValue("650");
  await other("Status").selectOption("pm");
  await expect(other("Daily rate")).toHaveValue("800.50");
  await other("Status").selectOption("am_pm");
  await expect(other("Daily rate")).toHaveValue("650");
  await other("Daily rate").fill("700");
  await save(page, "carlo");
  await page.goto(`/admin/reports?payDate=${OTHER}#payroll`);
  const otherDay = page
    .locator("section#payroll")
    .getByRole("row")
    .filter({ hasText: STAFF.carlo.name });
  await expect(otherDay).toContainText("AM/PM shift");
  await expect(otherDay).toContainText("9:30 AM");
  await expect(otherDay).toContainText("10:00 PM");
  await expect(otherDay).toContainText("₱700.00");

  // A raise afterwards doesn't change the day already recorded.
  await admin().from("employees").update({ salary_rate: 900 }).eq("id", ids.bea);

  await page.goto(`/admin/reports?payDate=${DAY}#payroll`);
  const section = page.locator("section#payroll");
  await expect(section.getByRole("heading", { name: "Payroll" })).toBeVisible();
  await expect(section).toContainText("Total payroll");
  await expect(section).toContainText("₱1,450.50");
  await expect(section.getByText("Employees paid").locator("..")).toContainText("2");
  const row = (who: keyof typeof STAFF) =>
    section.getByRole("row").filter({ hasText: STAFF[who].name });
  await expect(row("bea")).toContainText("AM shift");
  await expect(row("bea")).toContainText("9:30 AM");
  await expect(row("bea")).toContainText("3:00 PM");
  await expect(row("bea")).toContainText("edited");
  await expect(row("bea")).toContainText("₱650.00");
  await expect(row("carlo")).toContainText("PM shift");
  await expect(row("carlo")).toContainText("next day");
  await expect(row("carlo")).toContainText("₱800.50");
  await expect(row("dina")).toContainText("Rest day");
  await expect(row("dina")).toContainText("₱0.00");
  await expect(section.locator("tfoot")).toContainText("₱1,450.50");
  await expect(section).toContainText("Government contributions (SSS, PhilHealth, Pag-IBIG)");

  // Only Events.
  await section.getByLabel("Category", { exact: true }).selectOption("events");
  await expect(page).toHaveURL(/payCategory=events/);
  await expect(section.locator("tfoot")).toContainText("₱800.50");
  await expect(row("bea")).toHaveCount(0);

  // The PDF prints.
  const pdf = await page.request.get(`/admin/reports/payroll/pdf?date=${DAY}`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  // An empty day points to the time record.
  await page.goto("/admin/reports?payDate=2033-12-25#payroll");
  await expect(page.getByText("Nothing recorded for Sunday, 25 December 2033")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the time record" })).toBeVisible();
});
