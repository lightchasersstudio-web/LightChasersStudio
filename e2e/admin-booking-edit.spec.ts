import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { expect, test, type Page } from "@playwright/test";

/**
 * Changing a booking after it's made, and the owner-only delete. Runs against
 * the DEV project with temporary accounts:
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD  (a normal admin)
 *   E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD  (an owner, for the delete test)
 * Bookings use "E2E Client …"; `npm run data:clean-tests` removes leftovers.
 */
test.describe.configure({ mode: "serial" });

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** A staff booking far ahead (a different day per project), returns to its page. */
async function staffBooking(page: Page, name: string, daysAhead: number) {
  const day = format(addDays(TZDate.tz("Asia/Manila"), daysAhead), "yyyy-MM-dd");
  await page.goto(`/admin/bookings/new?date=${day}&time=10:00`);
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Mobile number").fill("0917 123 4567");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create booking" }).click();
  const anyway = page.getByRole("button", { name: "Book anyway" });
  await expect(page)
    .toHaveURL(/\/admin\/bookings\/[0-9a-f-]{36}$/, { timeout: 15_000 })
    .catch(async () => {
      await anyway.click();
      await expect(page).toHaveURL(/\/admin\/bookings\/[0-9a-f-]{36}$/);
    });
  return day;
}

test("staff change a confirmed booking: time, package, add-ons and VAT", async ({
  page,
}, testInfo) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL, "set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");
  await signIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  const name = `E2E Client Edit ${Date.now()}`;
  const day = await staffBooking(page, name, 470 + (testInfo.project.name === "mobile" ? 7 : 0));
  // A normal admin never sees the delete option.
  await expect(page.getByRole("heading", { name: "Danger zone" })).toHaveCount(0);

  await page.getByRole("link", { name: "Edit booking" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole("button", { name: "Pick any time instead" }).click();
  const nextDay = format(addDays(new Date(`${day}T12:00:00`), 1), "yyyy-MM-dd");
  await page.getByLabel("Date", { exact: true }).fill(nextDay);
  await page.getByLabel("Start time").fill("13:00");
  await page.getByLabel("Package", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Custom extra" }).click();
  await page.getByLabel("Add-on", { exact: true }).fill("Extra prints");
  await page.getByLabel("Add-on price", { exact: true }).fill("500");
  const vat = page.getByRole("checkbox", { name: /Charge \d+% VAT/ });
  if (await vat.count()) await vat.check();
  await expect(
    page.getByText("Total", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  const anyway = page.getByRole("button", { name: "Save anyway" });
  if (await anyway.isVisible().catch(() => false)) await anyway.click();

  await expect(page).toHaveURL(/\/admin\/bookings\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(
    page
      .getByText(/1:00 PM/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(/Extra prints/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(page.getByText(/Edited the booking: moved to/)).toBeVisible();

  // Tidy up: cancel it (cleanup removes cancelled E2E bookings).
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText("Booking cancelled.")).toBeVisible();
});

test("the owner can permanently delete an unpaid test booking", async ({ page }, testInfo) => {
  test.skip(!process.env.E2E_OWNER_EMAIL, "set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD");
  test.skip(testInfo.project.name === "mobile", "one owner run is enough");
  await signIn(page, process.env.E2E_OWNER_EMAIL!, process.env.E2E_OWNER_PASSWORD!);
  await staffBooking(page, `E2E Client Delete ${Date.now()}`, 480);
  const url = page.url();
  const reference = (await page
    .getByText(/^BK-\d{4}-[0-9A-F]{6}$/)
    .filter({ visible: true })
    .first()
    .textContent())!;

  await page.getByRole("button", { name: "Delete booking permanently" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Delete permanently" })).toBeDisabled();
  await dialog.getByLabel("Booking reference").fill(reference.toLowerCase());
  await dialog.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/\/admin\/calendar/);

  await page.goto(url);
  await expect(page.getByRole("heading", { name: /couldn't find/i })).toBeVisible();
});
