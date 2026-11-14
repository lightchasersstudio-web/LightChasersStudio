import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Payroll against the DEV Supabase project: payslips from the time record, a
 * change showing at once, printing saving them. Needs an admin login and the service role key (it adds its own
 * employees and time records, and removes them and its payroll afterwards).
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe.configure({ mode: "serial" });
test.skip(!email || !password || !url || !key, "needs admin login and the service role key");

const RUN = `E2E Staff ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const MONTHLY = `${RUN} Monthly`;
const DAILY = `${RUN} Daily`;
const admin = () => createClient(url!, key!, { auth: { persistSession: false } });

// A cut-off far from real data, different per project (they run side by side).
const cutoffFor = (project: string) => (project === "mobile" ? "2031-01-16" : "2031-01-01");
let cutoff = "";
const ids: Record<string, string> = {};

test.beforeAll(async ({}, testInfo) => {
  cutoff = cutoffFor(testInfo.project.name);
  const sb = admin();
  // A payroll left by an earlier, interrupted run.
  await sb.from("payroll_periods").delete().eq("period_start", cutoff);
  const { data, error } = await sb
    .from("employees")
    .insert([
      {
        full_name: MONTHLY,
        position: "Photographer",
        date_hired: "2026-01-05",
        salary_type: "monthly",
        salary_rate: 30000, // ÷ 30 days = ₱1,000 a day, ÷ 8 hours = ₱125 an hour
        overtime_rate: 200,
      },
      {
        full_name: DAILY,
        position: "Assistant",
        date_hired: "2026-01-05",
        salary_type: "daily",
        salary_rate: 650,
      },
    ])
    .select("id, full_name");
  if (error) throw error;
  for (const e of data) ids[e.full_name] = e.id;
  await sb.from("employee_benefits").update({ sss_enabled: false }).eq("employee_id", ids[DAILY]!);

  // Monthly: 10 full days, one 8 AM–12 PM (4 h short), one 8 AM–6 PM (2 h overtime),
  // 1 absent. Daily: 11 full days + 1 holiday.
  const day = (n: number) =>
    `${cutoff.slice(0, 8)}${String(Number(cutoff.slice(8)) + n).padStart(2, "0")}`;
  const present = (id: string, n: number, timeOut = "16:00") => ({
    employee_id: id,
    work_date: day(n),
    status: "present",
    time_in: "08:00",
    time_out: timeOut,
  });
  const logs = [
    ...Array.from({ length: 10 }, (_, n) => present(ids[MONTHLY]!, n)),
    present(ids[MONTHLY]!, 10, "12:00"),
    present(ids[MONTHLY]!, 11, "18:00"),
    { employee_id: ids[MONTHLY]!, work_date: day(12), status: "absent" },
    ...Array.from({ length: 11 }, (_, n) => present(ids[DAILY]!, n)),
    { employee_id: ids[DAILY]!, work_date: day(11), status: "holiday" },
  ];
  const { error: logError } = await sb.from("attendance_logs").insert(logs);
  if (logError) throw logError;
});

test.afterAll(async ({}, testInfo) => {
  const sb = admin();
  await sb.from("payroll_periods").delete().eq("period_start", cutoffFor(testInfo.project.name));
  const { data } = await sb.from("employees").select("id").like("full_name", `${RUN}%`);
  const list = (data ?? []).map((e) => e.id);
  if (list.length) {
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

test("payroll: payslips follow the time record, printing saves them", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  // Gross and deductions show from laptop width; net pay on every screen.
  const wide = testInfo.project.name !== "mobile";
  const entry = (name: string) =>
    page.getByRole("list", { name: "Payslips" }).getByRole("listitem").filter({ hasText: name });
  await signIn(page);
  await page.goto(`/admin/payroll?date=${cutoff}`);
  await expect(page.getByRole("heading", { name: /^Payslips · Jan/ })).toBeVisible();

  const monthly = entry(MONTHLY);
  await expect(monthly).toContainText("₱12,675.00"); // net
  const daily = entry(DAILY);
  await expect(daily).toContainText("₱6,806.25"); // 11 × ₱650 − PhilHealth ₱243.75 − Pag-IBIG ₱100
  if (wide) {
    await expect(monthly).toContainText("₱15,400.00"); // half of ₱30,000 + ₱400 overtime
    await expect(daily).toContainText("₱7,150.00");
  }

  await monthly.getByRole("button", { name: `View ${MONTHLY}'s payslip` }).click();
  const slip = page.getByRole("dialog");
  await expect(slip).toContainText("Half of ₱30,000.00 monthly");
  await expect(slip).toContainText("2h × ₱200.00 an hour");
  await expect(slip).toContainText("1 unpaid day × ₱1,000.00");
  await expect(slip).toContainText("4h short × ₱125.00 an hour");
  await expect(slip).toContainText("Net pay₱12,675.00");
  await page.keyboard.press("Escape");

  // The absence turns out to be a work day: the running cut-off shows it at once.
  const sb = admin();
  const { error } = await sb
    .from("attendance_logs")
    .update({ status: "present", time_in: "08:00", time_out: "16:00" })
    .eq("employee_id", ids[MONTHLY]!)
    .eq("status", "absent");
  expect(error).toBeNull();
  await page.reload();
  await expect(entry(MONTHLY)).toContainText("₱13,675.00");

  // Printing saves the payslips (no separate "save payroll" step).
  const res = await page.request.get(`/admin/payroll/pdf?cutoff=${cutoff}`);
  expect(res.status()).toBe(200);
  const { data: period } = await sb
    .from("payroll_periods")
    .select("id")
    .eq("period_start", cutoff)
    .single();
  const { data } = await sb
    .from("payslips")
    .select("net_pay, sss_deduction")
    .eq("payroll_period_id", period!.id)
    .in("employee_id", [ids[MONTHLY]!, ids[DAILY]!]);
  expect(data?.map((p) => [Number(p.net_pay), p.sss_deduction]).sort()).toEqual(
    [
      [6806.25, null],
      [13675, 750],
    ].sort(),
  );
});

test("PDFs: payslips (all and one) and employee details, admins only", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto(`/admin/payroll?date=${cutoff}`);
  const pdfs = {
    payslips: `/admin/payroll/pdf?cutoff=${cutoff}`,
    payslip: `/admin/payroll/pdf?cutoff=${cutoff}&employee=${ids[MONTHLY]}`,
    employee: `/admin/employees/${ids[DAILY]}/pdf`,
    staff: `/admin/employees/pdf`,
  };
  await expect(page.getByRole("link", { name: "Print all payslips" })).toHaveAttribute(
    "href",
    pdfs.payslips,
  );
  await expect(page.getByRole("link", { name: `${MONTHLY}'s payslip PDF` })).toHaveAttribute(
    "href",
    pdfs.payslip,
  );

  for (const [name, href] of Object.entries(pdfs)) {
    const res = await page.request.get(href);
    expect(res.status(), name).toBe(200);
    expect(res.headers()["content-type"], name).toBe("application/pdf");
    const body = await res.body();
    expect(body.subarray(0, 5).toString(), name).toBe("%PDF-");
    // Set PDF_OUT to keep copies for a look.
    if (process.env.PDF_OUT) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(`${process.env.PDF_OUT}/${name}-${testInfo.project.name}.pdf`, body);
    }
  }

  // Not a cut-off: refused. Signed out: no PDF.
  expect((await page.request.get("/admin/payroll/pdf?cutoff=2031-03-05")).status()).toBe(400);
  const stranger = await browser.newContext();
  const res = await stranger.request.get(pdfs.payslips, { maxRedirects: 0 });
  expect(res.headers()["content-type"] ?? "").not.toBe("application/pdf");
  expect([307, 401]).toContain(res.status());
  await stranger.close();
});
