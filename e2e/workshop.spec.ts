import { expect, test, type Page } from "@playwright/test";

/**
 * Workshop sign-up: the left-hand button → details → pay in full → pretend
 * checkout → the admin sees it as a workshop with the half refund due.
 * Trial mode (PAYMENTS_MOCK=true on the server and here) + E2E_ADMIN_EMAIL/PASSWORD.
 */
test.skip(process.env.PAYMENTS_MOCK !== "true", "trial mode only (PAYMENTS_MOCK=true)");

async function pickFreeTime(page: Page) {
  const days = page.getByRole("group", { name: /^Dates in / });
  await expect(days).toHaveAttribute("aria-busy", "false");
  for (let i = 0; i < 3; i++) {
    const free = days.locator("button[data-date]:not([disabled])");
    if ((await free.count()) > 0) {
      await free.nth(Math.min(8, (await free.count()) - 1)).click();
      await page.getByRole("group", { name: "Start times" }).getByRole("button").first().click();
      return;
    }
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(days).toHaveAttribute("aria-busy", "false");
  }
  throw new Error("no free times");
}

test("the workshop is reached from its own button, never listed as a package", async ({ page }) => {
  await page.goto("/services");
  await expect(page.getByRole("main").getByText("Photography Workshop")).toHaveCount(0);
  await page.getByRole("link", { name: /^Workshop/ }).click();
  await expect(page).toHaveURL(/\/workshop$/);
  await expect(page.getByRole("heading", { name: "Workshop sign-up" })).toBeVisible();
});

test("sign up, pay in full, and the admin sees the half refund due", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "one booking per run is enough");
  test.skip(!process.env.E2E_ADMIN_EMAIL, "set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");
  const name = `E2E Client Workshop ${Date.now()}`;

  await page.goto("/workshop");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill("e2e-workshop@example.com");
  await page.getByLabel("Mobile number").fill("0917 123 4567");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();

  // Payment: the refund rule must be accepted.
  await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Please confirm you understand the refund rule.")).toBeVisible();
  await page.getByText("Pay in full").click();
  await page.getByRole("checkbox", { name: /Refund rule/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await pickFreeTime(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/paying in full/)).toBeVisible();
  const pay = page.getByRole("button", { name: /^Pay ₱[\d,.]+$/ });
  await pay.click();

  await expect(page).toHaveURL(/\/book\/mock-checkout\?/);
  await page.getByRole("button", { name: /Pay .* \(test\)/ }).click();
  await expect(page).toHaveURL(/\/book\/done\?ref=BK-/);

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.getByText(/chose to pay\s+in full/)).toBeVisible();
  await expect(page.getByText(/If they can't attend, refund ₱[\d,.]+ \(half\)/)).toBeVisible();

  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText("Booking cancelled.")).toBeVisible();
});
