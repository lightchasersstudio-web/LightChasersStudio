import { expect, test, type Page } from "@playwright/test";

/** Picks the first day with free times (this month or next) and its first time. */
async function pickFirstFreeTime(page: Page) {
  const days = page.getByRole("group", { name: /^Dates in / });
  await expect(days).toHaveAttribute("aria-busy", "false");
  for (let i = 0; i < 3; i++) {
    const free = days.locator("button[data-date]:not([disabled])");
    if ((await free.count()) > 0) {
      await free.first().click();
      await page.getByRole("group", { name: "Start times" }).getByRole("button").first().click();
      return;
    }
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(days).toHaveAttribute("aria-busy", "false");
  }
  throw new Error("no free times in the next three months (check opening hours)");
}

test("Book now on a package opens the wizard with it chosen and walks to payment", async ({
  page,
}) => {
  await page.goto("/services");
  const card = page.getByRole("article").first();
  const name = (await card.getByRole("heading").textContent())!.trim();
  await card.getByRole("link", { name: `Book now: ${name}` }).click();
  await expect(page).toHaveURL(/\/book\?service=/);

  // Step 1: details (validation first)
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();
  await page.getByLabel("Full name").fill("E2E Client Wizard");
  await page.getByLabel("Email").fill("e2e-wizard@example.com");
  await page.getByLabel("Mobile number").fill("0917 123 4567");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2: the package from the card is already chosen
  await expect(page.getByRole("heading", { name: "Package" })).toBeFocused();
  await expect(page.getByRole("radio", { name: new RegExp(name) })).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: month calendar + times
  await expect(page.getByRole("heading", { name: "Date & time" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Pick a date and time.")).toBeVisible();
  await pickFirstFreeTime(page);
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4: shoot details
  await page.getByLabel("Number of people").fill("3");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 5: review shows the database price; submitting never charges without keys
  await expect(page.getByRole("heading", { name: "Review & pay" })).toBeVisible();
  await expect(page.getByText("Package price")).toBeVisible();
  await expect(page.getByText(name).first()).toBeVisible();
  const submit = page.getByRole("button", { name: /Pay .* deposit|Request booking/ });
  await submit.click();
  // Without a PayMongo key the server refuses before holding a slot.
  await expect(
    page.getByText(/Online payment isn't available yet|Too many attempts/),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/book/);
});

test("booking lookup never reveals whether a reference exists", async ({ page }) => {
  await page.goto("/booking?ref=BK-2026-ABCDEF");
  await expect(page.getByLabel("Booking reference")).toHaveValue("BK-2026-ABCDEF");
  await page.getByLabel("Email you booked with").fill("nobody@example.com");
  await page.getByRole("button", { name: "Find my booking" }).click();
  await expect(
    page.getByText(/couldn't find a booking with that reference and email|Too many attempts/),
  ).toBeVisible();
});

test("Book now on a different package replaces the earlier choice", async ({ page }) => {
  await page.goto("/services");
  const cards = page.getByRole("article");
  const first = (await cards.nth(0).getByRole("heading").textContent())!.trim();
  const second = (await cards.nth(1).getByRole("heading").textContent())!.trim();

  await cards
    .nth(0)
    .getByRole("link", { name: `Book now: ${first}` })
    .click();
  await expect(page).toHaveURL(/\/book\?service=/);
  // Leave without booking (browser back), then pick another package.
  await page.goBack();
  await expect(page).toHaveURL(/\/services$/);
  await page
    .getByRole("article")
    .nth(1)
    .getByRole("link", { name: `Book now: ${second}` })
    .click();
  await expect(page).toHaveURL(/\/book\?service=/);

  await page.getByLabel("Full name").fill("E2E Client Switch");
  await page.getByLabel("Email").fill("e2e-switch@example.com");
  await page.getByLabel("Mobile number").fill("0917 123 4567");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("radio", { name: new RegExp(second) })).toBeChecked();
  await expect(page.getByRole("radio", { name: new RegExp(first) })).not.toBeChecked();
});
