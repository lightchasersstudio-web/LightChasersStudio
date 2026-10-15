import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 3 admin flows against the DEV Supabase project. Every test cleans up
 * what it creates. Needs an admin account:
 *   E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… npx playwright test e2e/admin-content.spec.ts
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe.configure({ mode: "serial" });
test.skip(!email || !password, "set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");

// 1×1 PNG, enough for the browser-side resize + upload pipeline.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.beforeEach(async ({ page }) => signIn(page));

test("services: create, hide, edit and delete", async ({ page }) => {
  // Visits every public service page after edits, which regenerate on demand: slow under a full parallel run.
  test.setTimeout(60_000);
  const name = `E2E Package ${Date.now()}`;
  await page.goto("/admin/services/new");
  await page.getByLabel("Service name").fill(name);
  await expect(page.getByLabel("URL name")).toHaveValue(/^e2e-package-\d+$/);
  await page.getByLabel("Price").fill("2500");
  await page.getByLabel("Deposit", { exact: true }).selectOption("fixed");
  await page.getByLabel("Deposit amount").fill("9999");
  await page.getByRole("button", { name: "Create service" }).click();
  await expect(page.getByText("Deposit can't be more than the price.")).toBeVisible();

  await page.getByLabel("Deposit amount").fill("500");
  await page.getByRole("button", { name: "Create service" }).click();
  await expect(page).toHaveURL(/\/admin\/services\/[0-9a-f-]{36}$/);

  // The public (cached) services page picks up the change right away.
  await page.goto("/services");
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  // A slug that didn't exist at build time renders on demand (regression: 500 from usePathname).
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("₱2,500").first()).toBeVisible();

  await page.goto("/admin/services");
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("₱2,500");
  await row.getByRole("switch", { name: `${name} bookable` }).click();
  await expect(row.getByText("Hidden")).toBeVisible();
  await expect(page.getByText(`${name} is hidden.`)).toBeVisible(); // saved, not just optimistic

  await page.goto("/services");
  await expect(page.getByRole("heading", { name: "Services & packages" })).toBeVisible();
  await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);

  await page.goto("/admin/services");
  await row.getByRole("link", { name: `Edit ${name}` }).click();
  await page.getByLabel("Price").fill("3000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Service saved.")).toBeVisible();

  // Edits regenerate pages that were prerendered at build time (regression: 500 when
  // params were read outside <Suspense>). Check every public service page.
  await page.goto("/services");
  const hrefs = await page
    .getByRole("article")
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((a) => a.getAttribute("href")!).filter((h) => h.startsWith("/services/")),
    );
  for (const href of hrefs) {
    const res = await page.goto(href);
    expect(res?.status(), href).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  await page.goto("/admin/services");
  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(name)).toHaveCount(0);
});

test("availability: validates hours and blocks/unblocks a date", async ({ page }, testInfo) => {
  await page.goto("/admin/availability");
  const monday = page.getByRole("listitem").filter({ hasText: "Monday" }).first();
  if (!(await monday.getByRole("switch").isChecked())) await monday.getByRole("switch").click();
  await monday.getByRole("button", { name: "Add hours" }).click();
  await monday.getByLabel("Monday opens").last().fill("00:00");
  await monday.getByLabel("Monday closes").last().fill("23:59");
  await page.getByRole("button", { name: "Save opening hours" }).click();
  await expect(page.getByText("Monday has overlapping hours.")).toBeVisible();
  await page.reload({ waitUntil: "networkidle" }); // discard the invalid edit

  // ~300 days out avoids real blackouts; a different day per project so parallel runs don't collide.
  const days = 300 + (testInfo.project.name === "mobile" ? 1 : 0);
  const d = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Date", { exact: true }).fill(d);
  const reason = `E2E test ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Reason (optional)").fill(reason);
  await page.getByRole("button", { name: "Block", exact: true }).click();
  await expect(page.getByText("Date blocked.")).toBeVisible();
  const item = page.getByRole("listitem").filter({ hasText: reason });
  await item.getByRole("button", { name: /^Unblock/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(reason)).toHaveCount(0);
});

test("portfolio: upload, feature and delete a photo", async ({ page }) => {
  const alt = `E2E photo ${Date.now()}`;
  await page.goto("/admin/portfolio");
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: "e2e.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.getByLabel("Describe this photo").fill(alt);
  await page.getByRole("button", { name: "Upload 1 photo" }).click();
  await expect(page.getByText("Added 1 photo.")).toBeVisible();

  // Shows on the public gallery straight away, and opens in the lightbox.
  await page.goto("/portfolio");
  await page.getByRole("button", { name: `Open photo: ${alt}` }).click();
  await expect(page.getByRole("dialog").getByText(alt)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.goto("/admin/portfolio");

  const card = page.getByRole("listitem").filter({ hasText: alt });
  await card.getByRole("button", { name: "Feature photo on the home page" }).click();
  await expect(page.getByText("Featured on the home page.")).toBeVisible();
  await card.getByRole("button", { name: "Delete photo" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(alt)).toHaveCount(0);
});

test("settings: saves the studio profile and rejects bad links", async ({ page }, testInfo) => {
  // Shared single row: run once so parallel projects don't race on restoring it.
  test.skip(testInfo.project.name === "mobile", "covered by the desktop run");
  await page.goto("/admin/settings");
  const tagline = page.getByLabel("Tagline");
  const original = await tagline.inputValue();

  await page.getByLabel("Facebook page").fill("facebook.com/nope");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Use a full link starting with https://")).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });

  await tagline.fill(`E2E ${Date.now()}`);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Studio profile saved.")).toBeVisible();
  await tagline.fill(original);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Studio profile saved.").last()).toBeVisible();
});

test("mobile: navigation menu reaches every section", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const label of ["Services", "Availability", "Portfolio", "Settings", "Account"]) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("dialog").getByRole("link", { name: label }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/admin/${label.toLowerCase()}`));
  }
});
