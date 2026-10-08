import { expect, test } from "@playwright/test";

test("public home renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("signed-out visitors are sent from /admin to the login page", async ({ page }) => {
  await page.goto("/admin/bookings?status=pending");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fbookings%3Fstatus%3Dpending/);
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("login form validates before calling Supabase", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Enter your password.")).toBeVisible();
});
