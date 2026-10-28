import { expect, test } from "@playwright/test";

/**
 * Workshop sign-up: the left-hand button → details → pay in full → pretend
 * checkout → the admin sees it as a workshop with the half refund due. There's
 * no date step: everyone joins the time the admin set on the workshop.
 * Trial mode (PAYMENTS_MOCK=true on the server and here) + E2E_ADMIN_EMAIL/PASSWORD,
 * and the workshop needs a future date in Admin → Services.
 */
test.skip(process.env.PAYMENTS_MOCK !== "true", "trial mode only (PAYMENTS_MOCK=true)");

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
  test.skip(
    (await page.getByLabel("Full name").count()) === 0,
    "the workshop has no future date (or no seats) on this database",
  );
  await expect(page.getByText(/^Date$/)).toBeVisible();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill("e2e-workshop@example.com");
  await page.getByLabel("Mobile number").fill("0917 123 4567");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();

  // Who's coming: no calendar, no location; the price is per person.
  await expect(page.getByRole("heading", { name: "Who's coming" })).toBeVisible();
  await expect(page.getByRole("group", { name: /^Dates in / })).toHaveCount(0);
  await expect(page.getByLabel("Location (optional)")).toHaveCount(0);
  await expect(page.getByText("4 people")).toHaveCount(0); // up to 3 per sign-up
  await page.getByText("2 people", { exact: true }).click();
  await expect(page.getByText(/Workshop price for 2 people/)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // A card per person: certificate name, contact details and price category.
  // The first starts with the booker's name and number.
  await expect(page.getByRole("heading", { name: "Certificates" })).toBeVisible();
  const names = page.getByLabel("Full name (for the certificate)");
  const phones = page.getByLabel("Mobile number");
  const addresses = page.getByLabel("Address");
  await expect(names.first()).toHaveValue(name);
  await expect(phones.first()).toHaveValue("0917 123 4567");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter their full name for the certificate.")).toBeVisible();
  await expect(page.getByText("Enter their mobile number.")).toBeVisible();
  await expect(page.getByText("Enter their address.").first()).toBeVisible();
  await names.nth(1).fill("E2E Guest");
  await phones.nth(1).fill("0918 765 4321");
  await addresses.nth(0).fill("Tetuan, Zamboanga City");
  await addresses.nth(1).fill("Pasonanca, Zamboanga City");
  // A student must upload an ID; switch back to Regular instead.
  const person2 = page.getByRole("radiogroup", { name: "Person 2: price category" });
  await person2.getByText("Student", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Upload ID" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Upload a photo of their student ID.")).toBeVisible();
  await person2.getByText("Regular", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Payment: the refund rule must be accepted.
  await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Please confirm you understand the refund rule.")).toBeVisible();
  await page.getByText("Pay in full").click();
  await page.getByRole("checkbox", { name: /Refund rule/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText(/2 people · paying in full/)).toBeVisible();
  await expect(page.getByText(`${name} (Regular), E2E Guest (Regular)`)).toBeVisible();
  // The workshop's time shows, with no way to change it.
  await expect(page.getByRole("button", { name: "Edit when" })).toHaveCount(0);
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
