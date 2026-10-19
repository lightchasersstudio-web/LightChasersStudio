# Handoff: Light Chasers Studio booking site

_Last updated: 2026-10-17. Phases 0–5 are on `main`; online payments and emails wait on the owner's PayMongo and Turnstile keys; emails go out from the studio Gmail._

This document says where the project stands: what's built, what's verified, what's left, and the decisions and limits a new person needs to know. For first-time setup on a new machine, see [`SETUP.md`](SETUP.md). For the full product spec and roadmap, see [`master-prompt.md`](master-prompt.md). For coding rules and architecture notes, see [`../CLAUDE.md`](../CLAUDE.md).

## The project in one paragraph

A booking website for **Light Chasers Studio**, a photography studio in Zamboanga City (weddings & prenups, portraits & family, events, product shoots). Visitors browse services and the portfolio without logging in, pick a free date and time on a month calendar, and pay a deposit through PayMongo (GCash and others). Staff can also book clients in themselves from an admin calendar. Staff manage everything from an admin area at `/admin`, which is the only part that needs a login. Built with Next.js 16, Tailwind v4, shadcn/ui and Supabase (Postgres, Auth, Storage).

## Where we left off

- **Phases 0–5 are built, verified and merged into `main`** (Phase 5 = PR #7). The latest commit on `main` (`1d8f1ed`, contact page + logo) was pushed directly to `main` at the owner's request.
- **Online payment, emails and bot protection** switch on once the owner adds the PayMongo, Resend and Turnstile keys. Everything else works without them. See [Next steps](#next-steps).
- **Hosting:** the owner is setting up Vercel from `main`, using the **dev** Supabase project for now. A separate production database is still Phase 8.

## Roadmap status

| Phase | What                                                                        | Status                       | PR  |
| ----- | --------------------------------------------------------------------------- | ---------------------------- | --- |
| 0     | Foundation: project setup, design system, env, linting                      | ✅ Done                      | #1  |
| 1     | Database: schema, RLS, booking functions, storage, seed, types              | ✅ Done, pushed to dev DB    | #2  |
| 2     | Admin auth: login, route protection, admin shell, create-admin script       | ✅ Done, real login verified | #3  |
| 3     | Admin content: services, availability, portfolio, settings, account         | ✅ Done                      | #4  |
| 4     | Public site: home, services, portfolio, about, contact, 404, hero animation | ✅ Done                      | #5  |
| 5     | Booking flow + admin calendar, staff bookings, payments, emails             | ✅ Merged, needs owner keys  | #7  |
| 6     | Admin: dashboard stats, bookings table, clients, reschedule, privacy        | ⏳ Next                      |     |
| 7     | Hardening: security headers, accessibility, performance, SEO, sitemap       | Not started                  |     |
| 8     | Deploy: Vercel + production Supabase                                        | ⏳ Vercel (dev DB) underway  |     |

## What's built

### Phase 0: Foundation

- Next.js 16 App Router with `cacheComponents` (pages are pre-rendered by default), TypeScript, ESLint, Prettier, Vitest and Playwright.
- Env vars validated with zod: public vars in `src/lib/env.ts`, secrets in `src/lib/env.server.ts` (server-only).
- **Brand design system** (in `src/app/globals.css`):
  - Colours from the logo: evergreen, terracotta, sage and blush.
  - Fonts: Fraunces for headings, Nunito Sans for body text, Caveat for handwritten accents.
  - Photo motifs: polaroid frames, viewfinder corners, a dotted "studio" background, and the four-point sparkle from the logo.
  - Pill buttons, 44px touch targets, and a light/dark theme.

### Phase 1: Database (Supabase)

- Six migrations in `supabase/migrations/` cover the tables, Row Level Security on every table, booking functions, storage buckets (`portfolio`, `brand`), a cron job that expires unpaid holds, and an atomic save for weekly hours.
- **Double bookings are impossible at the database level.** An exclusion constraint on the booked time range (including the buffer time) enforces this.
- `create_booking` is a database function that only the server can call. It checks notice period, booking window, blackout dates, business hours and slot clashes.
- `supabase/seed.sql` holds **placeholder** services, prices and hours. Replace them in the admin.
- Generated types are in `src/types/database.types.ts`. DB tests are in `supabase/tests/` and run with `npm run test:db`.

### Phase 2: Admin login

- `/admin/login` uses email and password through Supabase Auth. **There is no public sign-up**; admins are created with `npm run admin:create`.
- Protection has three layers: `src/proxy.ts` redirects signed-out visitors, the protected layout checks admin status, and every admin page and server action re-checks with `requireAdmin()` / `assertAdmin()`.
- The login page has a split layout with a photo collage and works on all screen sizes.

### Phase 3: Admin content

- **Services:** create, edit, hide/show, reorder and delete. Each has a cover photo, price, deposit (percentage or fixed amount), duration and inclusions.
- **Availability:** weekly opening hours (several time ranges per day) and blackout dates.
- **Portfolio:** multi-photo upload, alt text, captions, categories, a "featured on home page" flag and ordering. Photos are resized in the browser to WebP, which also strips GPS/EXIF data.
- **Settings:** studio profile, logo, social links and booking rules (notice period, advance window, slot interval, buffer, default deposit, hold minutes).
- **Account:** change password.
- Every admin change is written to an audit log.

### Phase 4: Public site

- **Home:** hero with a **swipeable polaroid photo stack** (tap or swipe to shuffle, built with Motion), category tiles, featured photos, packages, "Behind the lens" and a booking banner.
- **Services:** a list grouped by category, plus a detail page per service with price, duration, deposit and inclusions.
- **Portfolio:** category filters, a masonry grid, and a full-screen viewer (swipe, arrow keys).
- **About and Contact:** contact details, social links, live opening hours and a Google Maps link.
- A branded 404 page, a sticky header with a mobile menu and a dark-mode toggle, and the footer.
- Every public page is static and loads instantly. Admin edits refresh the affected pages right away through cache tags (`src/lib/cache-tags.ts`).

### Phase 5: Booking flow and calendars

Design: `docs/superpowers/specs/2026-10-15-booking-calendar-design.md`. Plan: `docs/superpowers/plans/2026-10-15-booking-calendar.md`.

- **"Book now" everywhere.** A "Book now" next to a package (service card, service page, a portfolio photo linked to a package) opens the wizard with that package already chosen.
- **Booking wizard at `/book`:** your details → package → **month calendar + time list** → shoot details → review → PayMongo deposit. Dots show days with free times; fully booked and closed days are greyed out. Only truly free times are offered.
- **After paying:** `/book/done` (thanks + reference), `/book/cancelled` (try again while the slot is held), and `/booking` where a client views their booking card with reference + email.
- **Versa Space** is a new category, "studio rental". The home card links to it; the owner adds the actual rental package(s) and prices in Admin → Services.
- **Several shoots at once.** Settings → Booking rules → "Shoots that can run at the same time" (default 2). The database enforces it, even when two people book the last spot at the same moment.
- **Admin calendar (`/admin/calendar`):** month grid with colour-coded bookings, hatched closed/blocked days, and a day timeline with a dashed "free" lane. Click a free block to book a client into it.
- **Staff bookings (`/admin/bookings/new`):** confirmed straight away; email optional; custom price; deposit recorded as GCash, cash or "pay at the shoot"; times outside opening hours or on blocked days need a "Book anyway" click.
- **Booking page (`/admin/bookings/[id]`):** Call / Text / Email / Messenger buttons (preferred one highlighted, no Viber), a branded booking card to screenshot plus "Copy as text" for Messenger, confirm / decline / complete / cancel, record GCash or cash payments, private notes, resend email, and a warning banner if a PayMongo deposit arrived after the slot filled up.
- **Emails (studio Gmail, or Resend):** booking received, booking confirmed, declined/cancelled to the client; "new booking needs review" to the studio email in Settings.

### After Phase 5 (polish, 2026-10-15 → 16)

- **Versa Space "Coming soon".** While the Versa Space (studio rental) category has no active package, the home card shows a "Coming soon" tag and `/services#studio` shows a "Coming soon" panel. Adding a package replaces it automatically. Controlled by `comingSoon: true` on the category in `src/lib/catalog.ts`.
- **Contact page redesign** (`/contact`): Book now + "Message us on Facebook" buttons, a Facebook card (Messenger chat via `m.me/lightchasersstudio` + "Visit our page"), email / phone / Google Maps cards, a "help us reply faster" checklist and studio hours. The Facebook link (`https://www.facebook.com/lightchasersstudio/`) is saved in Admin → Settings, and the footer shows it on every page.
- **Logo everywhere:** admin sidebar and phone top bar, the booking card, and booking emails. The browser tab icon, phone home-screen icon and web manifest use the logo's camera emblem (`src/app/favicon.ico`, `icon.png`, `apple-icon.png`); link previews on Facebook/Messenger use the full logo (`src/app/opengraph-image.jpg`). To change them, replace those files.
- **Admin pages load instantly:** each admin page shows its title right away and a skeleton while the admin check and data load (`src/components/admin/skeletons.tsx`). This removed the dev warning "uncached data during a navigation".
- **Fixes:** "Book now" on a different package now replaces an earlier choice in the wizard (and the same for staff bookings from the calendar); a PayMongo payment that lands on a cancelled/declined/already-paid booking is kept and flagged for a refund check; online booking without PayMongo says "Online payment isn't available yet" instead of a security-check error.

### 2026-10-17: merged `front-end-extras`, booking fixes

- **Merged into `main`:** everything from `front-end-extras` / `payment-testing`: add-ons, 12% VAT (the studio is VAT-registered; set `vat_percent` to 0 in Settings to turn it off), stories, before/after, package compare, prep guide, draft save, share, unsaved-changes warning, and trial mode (`PAYMENTS_MOCK=true`, local testing only).
- **One booking per time slot:** two clients can no longer book the same time. A slot that's booked, or being paid for, plus the buffer after it, disappears for everyone else, and the database refuses a second booking even when two people click at once. It can be changed back in Settings → "Shoots that can run at the same time".
- **Back button in the booking form** now steps back through the steps (and keeps what was typed) instead of leaving for the home page.
- **Fixed:** "Continue" on Shoot details could submit the booking and skip the Review step.
- **Still to build** (plan: see the owner's approved plan):
  - Phase 6: bookings table, clients list + history, privacy anonymise, activity log (editing/rescheduling is done).
  - Phase 7: sitemap/robots, error pages, CSP/HSTS, accessibility/performance pass.
  - Phase 8: production Supabase + domain.

### 2026-10-17: booking management (branch `booking-management`)

- **Edit any booking** that's waiting for approval or confirmed: Booking page → **Edit booking**. Staff can change the date and time (the booking's own slot counts as free), package, package price, add-ons (from the catalog or a custom extra with its own price), VAT on/off, client contact and shoot details. The total, paid-so-far and balance update live. The slot, opening hours and days off are checked again on save, and "Save anyway" allows outside-hours times. **"Email the client the updated booking"** is ticked by default (skipped if the client has no email). Completed, cancelled, declined and expired bookings can't be edited.
- **Staff bookings can include add-ons** now (New booking form).
- **History panel** on each booking: who changed what, and when (from the audit log).
- **Permanent delete, owner only:** Booking page → Danger zone. The owner types the booking reference to confirm. Bookings with a real paid payment can't be deleted, only cancelled, so sales records stay true. Trial-mode payments don't count. The client is removed too if they have no other bookings.
- **Monthly CSV for accounting:** Sales report → Download CSV (`/admin/reports/export?month=YYYY-MM`). One row per booking in that month with package, add-ons, before-VAT, VAT, total, paid, balance and payment method. (The Sales report charts themselves still show sample data.)
- **Database:** migration `20261018000100_booking_management.sql` adds `admin_update_booking` and `delete_booking` (both service role only) and lets `admin_create_booking` take add-ons.

## Managing data

- **Two databases.** The dev project (`mkpjxrhjynbjuiovloiy`) is for testing and keeps all test bookings. The production project starts **empty** at go-live; never test there.
- **Clean test data on dev:** `npm run data:clean-tests` removes everything the e2e tests create (`E2E Client…` bookings and their payments/clients, `E2E Package…`, `E2E photo…`, `E2E test…` days off) and resets rate-limit counters. `npm run data:clean-tests -- --all-bookings` also wipes **every** booking, payment and client on dev (only with the owner's OK). The script refuses to run against any project other than dev.
- **Go-live copy:** `scripts/copy-catalog.mjs` copies packages, add-ons, opening hours, upcoming days off, portfolio, reviews, settings and their image files from dev to the new production project. It never copies bookings, payments or clients, and refuses a target that already has bookings. Run `npm run db:push` against production first, then `--dry-run`, then for real. **Not yet tested end to end** (needs the second project).
- **Real bookings:** cancel, don't delete. Every change is in the booking's History.
- **Backups:** turn on Supabase daily backups (and point-in-time recovery if the budget allows) on the production project before launch.
- **Accounting:** download the month's CSV from the Sales report.
- **Privacy requests (RA 10173):** handled later by an anonymise routine (Phase 6) that keeps the money records.

## How it's verified

| Check                 | Command                                                                           | Last result                                                |
| --------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Full project check    | `npm run check` (typecheck, lint, SQL parse, unit tests, build)                   | ✅ passing, 109 unit tests                                 |
| Database rules        | `npm run test:db` (needs `DATABASE_URL_TEST`)                                     | ✅ 32 passing against the dev project                      |
| Public site (browser) | `npm run test:e2e -- e2e/public-site.spec.ts`                                     | ✅ passing on desktop and phone (Pixel 7), touch included  |
| Admin flows (browser) | `e2e/admin-content.spec.ts` (needs an admin login, see below)                     | ✅ passing, includes public-page refresh after edits       |
| Booking (browser)     | `e2e/booking.spec.ts`, `e2e/admin-bookings.spec.ts`                               | ✅ wizard up to payment; staff booking, share, pay, cancel |
| Booking edit/delete   | `e2e/admin-booking-edit.spec.ts` (admin + `E2E_OWNER_EMAIL`/`E2E_OWNER_PASSWORD`) | ✅ edit time/package/add-ons/VAT; owner delete             |

The admin e2e tests need `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`. Use a **temporary** admin account, delete it afterwards, and never use the owner account. The tests clean up what they create: services named `E2E Package…`, photos with alt text `E2E photo…` and blackouts with reason `E2E test…`. Booking tests leave cancelled bookings named `E2E Client…`; run `npm run data:clean-tests` after a run.

On this machine a full parallel e2e run is sometimes flaky under load (an admin sign-in or the hero swipe test timing out); those tests pass when rerun on their own.

## Environments and accounts

- **Supabase dev project:** ref `mkpjxrhjynbjuiovloiy`, hosted (no local Docker). All migrations and the seed are applied.
- **Owner admin account:** exists on the dev project. Credentials are held by the studio owner and are never written in the repo.
- **GitHub:** `lightchasersstudio-web/LightChasersStudio`. Work normally goes on one branch and one PR per phase, merged into `main`. Every push to `main` redeploys the live site once Vercel is connected.
- **Vercel:** being set up by the owner from `main`, with the dev Supabase project. Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BUSINESS_TIMEZONE`, `NEXT_PUBLIC_SITE_URL` (the live address; used for emails, PayMongo return pages and link previews). The live site and local development share **one database**.
- **Not set up yet:** production Supabase, PayMongo, Resend (email) and Cloudflare Turnstile. Without their keys: emails are skipped, Turnstile is skipped in development only (production refuses bookings), and online booking says payment isn't available yet.

## Key decisions (don't undo these without a reason)

- **Money is stored as integer centavos** (`*_cents` columns, ₱1 = 100). Prices and deposits are always calculated on the server, never taken from the browser.
- **A booking counts as paid only through a signature-verified PayMongo webhook**, never through the "payment success" redirect.
- **Capacity lives in the database** (`assert_capacity`), not in the page. The calendars only mirror it.
- **Booking statuses:** `pending_payment → pending → confirmed → completed`, plus `cancelled`, `declined` and `expired`. A database trigger enforces the allowed transitions.
- **Unpaid bookings hold the slot** for a limited time (`hold_expires_at`). Expired holds are released by a cron job and also at the start of each new booking.
- **Admin role comes from the `admin_profiles` table**, never from anything the browser sends. The Supabase service-role key is only used on the server.
- **Images are stored as Storage paths, not full URLs.** Public queries use a cookie-free client inside `"use cache"`.
- **Privacy:** the site follows the Philippines Data Privacy Act (RA 10173). Phase 6 needs an anonymisation routine for deletion requests.
- **Copy:** don't invent business policies in page text (payment terms, travel, custom packages). Ask the owner first.

## Known limits and loose ends

- **Orphaned uploads:** if an admin uploads a cover photo and leaves without saving, the file stays in Storage. A comment in the code marks it. Clean up later with a scheduled job.
- **Reordering** services or photos saves as several separate updates, not one transaction. A failure halfway leaves a partial order, which is harmless and can be redone.
- **Unknown service URLs** (e.g. `/services/does-not-exist`) show the 404 page but return HTTP 200 with a `noindex` tag. That's how Next.js 16 handles pages generated on demand. Unmatched paths return a real 404.
- **The dev database has no portfolio photos yet**, so the site shows illustrated placeholder polaroids. Upload photos and star a few as "featured" in Admin → Portfolio to fill the home page.
- **Seed content is placeholder.** Real prices, packages, hours and the "about" text must come from the owner.
- **`npm audit` warnings** from dependencies haven't been reviewed. Do this in Phase 7.
- **The hero swipe** is tested in Chrome (desktop and Android emulation) but not yet on a real iPhone in Safari.
- **PayMongo webhook fields** follow PayMongo's docs but haven't seen a real test-mode event yet. Confirm `parsePaidEvent` in `src/lib/payments/paymongo.ts` against one when the keys exist.
- **Rate-limit rows** (`rate_limits`) are never purged. Add a cleanup if the table grows.
- **Staff time picker** (new booking) also offers times earlier today; the database accepts them.
- **Recording a payment** on a cancelled/declined booking is hidden in the UI but not refused by the server.
- **Short (1-hour) blocks** on the admin day timeline cut off their last line on narrow screens.
- **Calendar month arrows** change only the URL, so the old month stays on screen until the new one loads (no skeleton).
- **The GitHub CLI (`gh`) isn't installed** on the main dev machine, so PRs are opened from the GitHub website.

## Next steps

**Go live (owner):**

1. Finish the Vercel setup from `main` (env vars above), then in Supabase → Authentication → URL Configuration set the **Site URL** to the Vercel address and add both `https://<vercel-address>/**` and `http://localhost:3000/**` to **Redirect URLs**.
2. Replace the placeholder packages and prices in the admin, add the Versa Space rental package(s), and add a studio phone number in Settings if clients should call.

**Finish Phase 5 (needs the owner's accounts), in this order:**

1. **Cloudflare Turnstile:** add a widget for the Vercel address + `localhost`; set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
2. **Email (done on dev, 2026-10-19):** the studio has no domain, so emails go out from lightchasers.studio@gmail.com through a Google app password (`GMAIL_USER`, `GMAIL_APP_PASSWORD`; see `.env.example`). Add both in Vercel and redeploy. Changing the Gmail password cancels the app password: make a new one and update both places. Resend (`RESEND_API_KEY`, `EMAIL_FROM`) is only for a future owned domain.
3. **PayMongo (test mode first):** `PAYMONGO_SECRET_KEY` (`sk_test_…`); webhook at `https://<site>/api/webhooks/paymongo` for `checkout_session.payment.paid`, secret in `PAYMONGO_WEBHOOK_SECRET`. Make one test booking on the live site and check that it becomes "Deposit paid · needs your OK", the payment shows on the booking page, and the emails arrive. Confirm `parsePaidEvent` against the real payload (Vercel logs). If checkout fails, match `PAYMENT_METHODS` in `src/lib/payments/paymongo.ts` to the methods enabled on the account.
4. **Live payments:** activate the PayMongo account, then swap in the live key and a new live-mode webhook secret.
5. **Owner wording:** deposit rules and the cancellation/refund policy, to add to the review step and emails.

Add each key in Vercel (then redeploy) and in `.env.local`. `docs/SETUP.md` has the local details.

**Phase 6:** searchable bookings table, clients list with history, and the privacy anonymisation routine. (Editing/rescheduling, history and owner delete are done.)
