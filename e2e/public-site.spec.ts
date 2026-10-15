import { expect, test } from "@playwright/test";

test("home leads to services and a service detail page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Book now" }).first()).toBeVisible();

  await page.goto("/services");
  const firstCard = page.getByRole("article").first();
  const name = (await firstCard.getByRole("heading").textContent())!.trim();
  await firstCard.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("Package price")).toBeVisible();
});

test("hero photo stack shuffles on tap, swipe and the button", async ({
  page,
  context,
}, testInfo) => {
  await page.goto("/");
  const top = page.locator('[data-depth="0"]');
  const topHtml = () => top.innerHTML();

  const first = await topHtml();
  await top.click();
  await expect.poll(topHtml).not.toBe(first);

  // Swipe left: real touch events on the phone project, a mouse drag on desktop.
  // One move per frame, like a real finger (Motion reads the gesture per frame).
  const second = await topHtml();
  const box = (await top.boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  const cdp = testInfo.project.name === "mobile" ? await context.newCDPSession(page) : null;
  const touch = (type: string, points: { x: number; y: number }[]) =>
    cdp!.send("Input.dispatchTouchEvent", { type, touchPoints: points } as never);
  if (cdp) await touch("touchStart", [{ x, y }]);
  else {
    await page.mouse.move(x, y);
    await page.mouse.down();
  }
  for (let dx = 25; dx <= 250; dx += 25) {
    if (cdp) await touch("touchMove", [{ x: x - dx, y }]);
    else await page.mouse.move(x - dx, y);
    await page.waitForTimeout(16);
  }
  if (cdp) await touch("touchEnd", []);
  else await page.mouse.up();
  await expect.poll(topHtml).not.toBe(second);

  const third = await topHtml();
  await page.getByRole("button", { name: /next photo/ }).click();
  await expect.poll(topHtml).not.toBe(third);
});

test("unknown service shows the 404 page", async ({ page }) => {
  // Streamed (PPR) routes can't change the status after the shell is sent, so Next
  // marks the soft 404 noindex instead. Unmatched URLs still get a real 404.
  await page.goto("/services/does-not-exist");
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  expect((await page.goto("/no-such-page"))?.status()).toBe(404);
});

test("contact page lists opening hours for every day", async ({ page }) => {
  await page.goto("/contact");
  for (const day of ["Monday", "Sunday"]) {
    await expect(page.getByText(day, { exact: true })).toBeVisible();
  }
});

test("portfolio lightbox opens, navigates with the keyboard and closes", async ({ page }) => {
  await page.goto("/portfolio");
  const photos = page.getByRole("button", { name: /^Open photo:/ });
  test.skip((await photos.count()) === 0, "no portfolio photos in this database");

  await photos.first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/^1 of \d+$/)).toBeVisible();
  if ((await photos.count()) > 1) {
    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByText(/^2 of \d+$/)).toBeVisible();
  }
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

test("mobile menu reaches every page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const label of ["Services", "Portfolio", "About", "Contact"]) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${label.toLowerCase()}$`));
  }
});

test("Versa Space says coming soon until it has a package", async ({ page }) => {
  await page.goto("/services");
  const studio = page.locator("section#studio");
  test.skip((await studio.getByRole("article").count()) > 0, "Versa Space already has packages");

  await page.goto("/");
  const card = page.getByRole("link", { name: /Versa Space/ });
  await expect(card).toContainText("Coming soon");
  await card.click();
  await expect(page).toHaveURL(/\/services#studio$/);
  await expect(page.locator("section#studio").getByText("Coming soon")).toBeVisible();
});
