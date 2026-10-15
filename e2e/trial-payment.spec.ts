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
  await page.getByRole("button", { name: /Pay .* deposit/ }).click();

  await expect(page).toHaveURL(/\/book\/mock-checkout\?/);
  await expect(page.getByText("TEST MODE — no real money")).toBeVisible();
  await page.getByRole("button", { name: /Pay .* \(test\)/ }).click();
  await expect(page).toHaveURL(/\/book\/done\?ref=BK-/);
  await expect(page.getByRole("heading", { name: "Thank you!" })).toBeVisible();
  const reference = new URL(page.url()).searchParams.get("ref")!;

  // Admin sees it waiting for their OK, confirms it.
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const review = page.locator("section", {
    has: page.getByRole("heading", { name: /Needs your OK/ }),
  });
  await review.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("Needs review").first()).toBeVisible();
  await expect(page.getByText("PayMongo")).toBeVisible();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("Booking confirmed.")).toBeVisible();

  // Email previews: received (client + studio) and confirmed.
  await page.goto("/admin/trial-emails");
  await expect(page.getByText(`We received your booking ${reference}`)).toBeVisible();
  await expect(page.getByText(`Your booking ${reference} is confirmed`)).toBeVisible();

  // Clean up the slot.
  await page.goto("/admin");
  await page
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click();
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText("Booking cancelled.")).toBeVisible();
});
