import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { expect, test, type Page } from "@playwright/test";

/**
 * Admin calendar + booking a client in, against the DEV Supabase project.
 * Needs a (temporary) admin: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 * Bookings use the contact name "E2E Client …" and are cancelled at the end;
 * the cleanup script deletes them.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe.configure({ mode: "serial" });
test.skip(!email || !password, "set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("book a client in from a free time on the calendar, share it, take payment, cancel", async ({
  page,
  context,
}, testInfo) => {
  await signIn(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  // Far ahead (a different day per project) so real bookings and parallel runs don't collide.
  const start = addDays(
    TZDate.tz("Asia/Manila"),
    400 + (testInfo.project.name === "mobile" ? 20 : 0),
  );
  let freeSlot = null;
  for (let i = 0; i < 14 && !freeSlot; i++) {
    const day = format(addDays(start, i), "yyyy-MM-dd");
    await page.goto(`/admin/calendar?month=${day.slice(0, 7)}&day=${day}`);
    const links = page.getByRole("link", { name: /^Book from / });
    if ((await links.count()) > 0) freeSlot = links.first();
  }
  if (!freeSlot) throw new Error("no open day in two weeks (check opening hours)");
  await freeSlot.click();
  await expect(page).toHaveURL(/\/admin\/bookings\/new\?date=\d{4}-\d{2}-\d{2}&time=\d{2}:\d{2}/);
  await expect(page.getByLabel("Date", { exact: true })).not.toHaveValue("");
  await expect(page.getByLabel("Start time")).not.toHaveValue("");

  const name = `E2E Client ${Date.now()}`;
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Mobile number").fill("0917 123 4567");
  await page.getByRole("button", { name: "Create booking" }).click();
  await expect(page.getByText("Confirm the client agreed to the privacy notice.")).toBeVisible();
  await page.getByRole("radio", { name: "Paid in cash" }).check();
  await page.getByLabel("Amount received").fill("500");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create booking" }).click();

  // Lands on the booking: confirmed, no email needed, cash recorded.
  await expect(page).toHaveURL(/\/admin\/bookings\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("Confirmed").first()).toBeVisible();
  await expect(page.getByText(/Paid ₱500 of/)).toBeVisible();
  const reference = (await page
    .getByText(/^BK-\d{4}-[0-9A-F]{6}$/)
    .first()
    .textContent())!;

  // Copy as text for Messenger.
  await page.getByRole("button", { name: "Copy as text" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(reference);

  // Balance paid by GCash later.
  await page.getByLabel("Amount", { exact: true }).fill("300");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/Paid ₱800 of/)).toBeVisible();

  // It shows on the calendar.
  await page.getByRole("main").getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page.getByRole("link", { name: new RegExp(name) }).first()).toBeVisible();

  // Cancel it (frees the time; cleanup deletes it).
  await page
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click();
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText("Booking cancelled.")).toBeVisible();
  await expect(page.getByText("Cancelled").first()).toBeVisible();
});

test("calendar warns before booking outside opening hours", async ({ page }, testInfo) => {
  await signIn(page);
  const day = format(
    addDays(TZDate.tz("Asia/Manila"), 450 + (testInfo.project.name === "mobile" ? 3 : 0)),
    "yyyy-MM-dd",
  );
  await page.goto(`/admin/bookings/new?date=${day}&time=23:00`);
  await page.getByLabel("Name", { exact: true }).fill(`E2E Client late ${Date.now()}`);
  await page.getByLabel("Mobile number").fill("0917 123 4567");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create booking" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Book it anyway/ })).toBeVisible();
  await page.getByRole("button", { name: "Book anyway" }).click();
  await expect(page).toHaveURL(/\/admin\/bookings\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText("Booking cancelled.")).toBeVisible();
});
