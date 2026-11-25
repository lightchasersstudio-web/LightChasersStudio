import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * No page is wider than a phone (375 px) or a tablet (768 px): every public
 * and admin page.
 * Needs an admin login and the service role key. Runs once (it sets its own
 * screen sizes), in the desktop project.
 */
test.skip(
  !process.env.E2E_ADMIN_EMAIL || !process.env.SUPABASE_SERVICE_ROLE_KEY,
  "needs admin login and the service role key",
);
test.skip(({ isMobile }) => isMobile, "sets its own screen sizes");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
  },
);
const dyn: Record<string, string> = {};

test.beforeAll(async () => {
  const b = await sb.from("bookings").select("id").limit(1).maybeSingle();
  const c = await sb.from("clients").select("id").limit(1).maybeSingle();
  const s = await sb
    .from("services")
    .select("id, slug")
    .eq("is_active", true)
    .neq("category", "workshop")
    .limit(1)
    .maybeSingle();
  dyn.booking = b.data?.id ?? "";
  dyn.client = c.data?.id ?? "";
  dyn.service = s.data?.id ?? "";
  dyn.slug = s.data?.slug ?? "";
});

async function overflow(page: Page) {
  return page.evaluate(() => {
    const w = window.innerWidth;
    if (document.documentElement.scrollWidth <= w + 1) return null;
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const r = el.getBoundingClientRect();
      if (r.right <= w + 1 || r.width === 0) continue;
      // inside a horizontally scrolling box is fine
      let p = el.parentElement,
        scrolls = false;
      while (p) {
        const o = getComputedStyle(p).overflowX;
        if (o === "auto" || o === "scroll" || o === "hidden") {
          scrolls = true;
          break;
        }
        p = p.parentElement;
      }
      if (scrolls) continue;
      bad.push(
        `${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").split(" ").slice(0, 3).join(".")} right=${Math.round(r.right)}`,
      );
      if (bad.length > 4) break;
    }
    return { scrollWidth: document.documentElement.scrollWidth, w, bad };
  });
}

for (const width of [375, 768]) {
  test(`no page is wider than ${width}px`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin$/);
    const routes = [
      "/",
      "/about",
      "/services",
      `/services/${dyn.slug}`,
      "/portfolio",
      "/contact",
      "/faq",
      "/prepare",
      "/privacy",
      "/book",
      "/booking",
      "/workshop",
      "/admin",
      "/admin/account",
      "/admin/activity",
      "/admin/availability",
      "/admin/bookings",
      `/admin/bookings/${dyn.booking}`,
      `/admin/bookings/${dyn.booking}/edit`,
      "/admin/bookings/new",
      "/admin/calendar",
      "/admin/clients",
      `/admin/clients/${dyn.client}`,
      "/admin/faq",
      "/admin/portfolio",
      "/admin/reports",
      "/admin/reviews",
      "/admin/services",
      `/admin/services/${dyn.service}`,
      "/admin/services/new",
      "/admin/settings",
      "/admin/trial-emails",
    ];
    for (const r of routes) {
      await page.goto(r);
      await page.waitForLoadState("networkidle").catch(() => {});
      const o = await overflow(page);
      expect.soft(o, `${r} at ${width}px`).toBeNull();
    }
  });
}
