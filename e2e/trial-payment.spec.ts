import { expect, test, type Page } from "@playwright/test";

/**
 * Trial mode (PAYMENTS_MOCK=true on the server AND in this test run): book and
 * "pay" through the pretend checkout, then see it on the admin dashboard,
 * confirm it, and check the email previews. Needs E2E_ADMIN_EMAIL/PASSWORD.
 */
test.skip(process.env.PAYMENTS_MOCK !== "true", "trial mode only (PAYMENTS_MOCK=true)");
test.skip(
  !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
  "set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD",
);

async function pickFirstFreeTime(page: Page) {
  const days = page.getByRole("group", { name: /^Dates in / });
  await expect(days).toHaveAttribute("aria-busy", "false");
  for (let i = 0; i < 3; i++) {
    const free = days.locator("button[data-date]:not([disabled])");
    if ((await free.count()) > 0) {
      // A later day avoids clashing with the other project's run.
      await free.nth(Math.min(5, (await free.count()) - 1)).click();
      await page.getByRole("group", { name: "Start times" }).getByRole("button").last().click();
      return;
    }
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(days).toHaveAttribute("aria-busy", "false");
  }
  throw new Error("no free times");
}

test("pay through the pretend checkout, then review and confirm it as admin", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "one booking per run is enough");
  const name = `E2E Client Mock ${Date.now()}`;

  // Client books and "pays".
  await page.goto("/services");
  const card = page.getByRole("article").first();
  const pkg = (await card.getByRole("heading").textContent())!.trim();
  await card.getByRole("link", { name: `Book now: ${pkg}` }).click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill("e2e-mock@example.com");
  await page.getByLabel("Mobile number").fill("0917 123 4567");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await pickFirstFreeTime(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Review & pay" })).toBeVisible();
  // Sign and agree to the package contract and the studio policy, when shown.
  await agreeToTerms(page, name);
  await page.getByRole("button", { name: /Pay .* deposit/ }).click();

  await expect(page).toHaveURL(/\/book\/mock-checkout\?/);
  await expect(page.getByText("TEST MODE — no real money")).toBeVisible();
  await page.getByRole("button", { name: /Pay .* \(test\)/ }).click();
  // Settling sends the emails and the receipt PDF first, which takes a few seconds.
  await expect(page).toHaveURL(/\/book\/done\?ref=BK-/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /^Thank you/, level: 1 })).toBeVisible();
  const reference = new URL(page.url()).searchParams.get("ref")!;

  // Admin sees it waiting for their OK, confirms it.
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  // Find it through the bookings search (the dashboard only shows the first few).
  await page.goto(`/admin/bookings?q=${encodeURIComponent(name)}`);
  await page
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(
    page.getByText("Needs review", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("PayMongo").filter({ visible: true }).first()).toBeVisible();
  // Every payment gets a numbered receipt (studio policy 1.5).
  await expect(page.getByText(/Receipt AR-\d{4}-\d{5}/).first()).toBeVisible();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("Booking confirmed.")).toBeVisible({ timeout: 15_000 });

  // Email previews: received (client + studio) and confirmed. With the studio
  // Gmail set up, emails are really sent instead, so there are no previews.
  if (!process.env.GMAIL_USER) {
    await page.goto("/admin/trial-emails");
    await expect(page.getByText(`We received your booking ${reference}`)).toBeVisible();
    await expect(page.getByText(`Your booking ${reference} is confirmed`)).toBeVisible();
  }

  // Clean up the slot.
  await page.goto(`/admin/bookings?q=${encodeURIComponent(name)}`);
  await page
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click();
  await page.getByRole("button", { name: "Cancel booking" }).click();
  // The dialog asks why and says what the policy means for the money.
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("radio", { name: /The client cancelled/ })).toBeChecked();
  await expect(dialog.getByText(/is kept, not refunded/)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText("Booking cancelled.")).toBeVisible({ timeout: 15_000 });
});

/** Review & pay: sign + tick the package contract and tick the studio policy, when the package has them. */
async function agreeToTerms(page: Page, fullName: string) {
  // The step slides in: wait for its content before looking for the terms.
  await expect(page.getByText(/We hold (this time|your seats?) for/)).toBeVisible();
  const signature = page.getByLabel("Sign by typing your full name");
  if (await signature.isVisible()) {
    await signature.fill(fullName);
    await page.getByRole("checkbox", { name: /contract above/ }).check();
  }
  const policy = page.getByRole("checkbox", { name: /Studio Policy Manual/ });
  if (await policy.isVisible()) await policy.check();
}
