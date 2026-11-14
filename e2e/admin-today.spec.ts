import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { expect, test, type Page } from "@playwright/test";

/**
 * Shoot day on the Today page (Studio Policy 1.3, 2.3, 2.5, 3.9): ID, the two
 * inspections, the balance and the security deposit. Runs against the DEV
 * project with E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD; the booking is cancelled
 * at the end ("E2E Client …", `npm run data:clean-tests` removes leftovers).
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
test.skip(!email || !password, "set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("today: tick the steps, take the balance and the deposit, give the deposit back", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const name = `E2E Client Today ${Date.now()}`;
  // A studio package far ahead, a different day per project (they run side by side).
  const day = format(
    addDays(TZDate.tz("Asia/Manila"), testInfo.project.name === "mobile" ? 521 : 520),
    "yyyy-MM-dd",
  );
  await signIn(page);
  await page.goto(`/admin/bookings/new?date=${day}&time=10:00`);
  await page.waitForLoadState("networkidle"); // let React hydrate before filling the form
  await page.getByLabel("Package").selectOption({ label: "Family Portrait Session" });
  await expect(page.getByLabel("Package")).toHaveValue(/.+/);
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Mobile number").fill("0917 123 4567");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create booking" }).click();
  await expect(page)
    .toHaveURL(/\/admin\/bookings\/[0-9a-f-]{36}$/, { timeout: 15_000 })
    .catch(async () => {
      await page.getByRole("button", { name: "Book anyway" }).click();
      await expect(page).toHaveURL(/\/admin\/bookings\/[0-9a-f-]{36}$/);
    });
  const bookingUrl = page.url();

  await page.goto(`/admin/today?date=${day}`);
  const card = page.getByRole("article", { name: new RegExp(name) });
  await expect(card).toContainText("0 of 4 done");

  // ID and check-in inspection.
  await card.getByRole("checkbox", { name: "ID checked" }).click();
  await expect(card.getByRole("checkbox", { name: "ID checked" })).toBeChecked();
  await card.getByRole("checkbox", { name: "Check-in inspection" }).click();
  await expect(card.getByRole("checkbox", { name: "Check-in inspection" })).toBeChecked();

  // The balance, pre-filled with what's due.
  await card.getByRole("button", { name: "Record payment" }).click();
  const pay = page.getByRole("dialog");
  await pay.getByLabel("Paid by").selectOption("cash");
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(card).toContainText("Paid in full", { timeout: 15_000 });

  // They brought a dog: collect the deposit, then keep ₱500 for cleaning.
  await card.getByRole("button", { name: "Collect" }).click();
  const collect = page.getByRole("dialog");
  await expect(collect.getByLabel("Amount")).toHaveValue("2000");
  await collect.getByRole("button", { name: "Record deposit" }).click();
  await expect(card).toContainText("Holding ₱2,000 (Cash)");

  await card.getByRole("button", { name: "Return" }).click();
  const give = page.getByRole("dialog");
  await give.getByLabel("Amount given back").fill("1500");
  await give.getByRole("button", { name: "Record return" }).click();
  await expect(give.getByText(/Say what the kept amount is for/).first()).toBeVisible();
  await give.getByLabel("If you kept some: what for").fill("Cleaning fee");
  await give.getByRole("button", { name: "Record return" }).click();
  await expect(card).toContainText("Returned ₱1,500, kept ₱500: Cleaning fee");

  await card.getByRole("checkbox", { name: "Check-out inspection" }).click();
  await expect(card).toContainText("All done");

  // The booking page shows the same card and the history.
  await page.goto(bookingUrl);
  await expect(page.getByRole("heading", { name: "Shoot day" })).toBeVisible();
  const history = page.locator("section", { has: page.getByRole("heading", { name: "History" }) });
  await expect(history).toContainText("Ticked: ID checked");
  await expect(history).toContainText("Collected a ₱2,000 security deposit (cash)");
  await expect(history).toContainText("Returned ₱1,500 of the security deposit, kept ₱500");

  // An extra charge after the shoot (policy 3.2): 2 yards of backdrop paper.
  await page.getByRole("button", { name: "Add a charge" }).click();
  const charge = page.getByRole("dialog");
  await charge.getByLabel("What for").selectOption("backdrop_paper");
  await charge.getByLabel("How many yards").fill("2");
  await charge.getByRole("button", { name: "Add charge" }).click();
  await expect(page.getByText(/Backdrop paper × 2 yards/).first()).toBeVisible({
    timeout: 15_000,
  });

  // Clean up the slot.
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText("Booking cancelled.")).toBeVisible({ timeout: 15_000 });
});
