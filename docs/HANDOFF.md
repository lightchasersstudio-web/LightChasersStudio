# Handoff: Light Chasers Studio booking site

_Last updated: 2026-10-15, Phase 5 built (waiting on payment/email keys)._

This document says where the project stands: what's built, what's verified, what's left, and the decisions and limits a new person needs to know. For first-time setup on a new machine, see [`SETUP.md`](SETUP.md). For the full product spec and roadmap, see [`master-prompt.md`](master-prompt.md). For coding rules and architecture notes, see [`../CLAUDE.md`](../CLAUDE.md).

## The project in one paragraph

A booking website for **Light Chasers Studio**, a photography studio in Zamboanga City (weddings & prenups, portraits & family, events, product shoots). Visitors browse services and the portfolio without logging in, pick a free date and time on a month calendar, and pay a deposit through PayMongo (GCash and others). Staff can also book clients in themselves from an admin calendar. Staff manage everything from an admin area at `/admin`, which is the only part that needs a login. Built with Next.js 16, Tailwind v4, shadcn/ui and Supabase (Postgres, Auth, Storage).

## Where we left off

- **Phases 0–4 are built and verified.** Phase 4 (public site) is on branch `phase-4-public-site`, with a PR open against `main`.
- **Phase 5 (booking flow + calendars) is built** on branch `phase-5-booking`. Online payment, emails and bot protection switch on once the owner adds the PayMongo, Resend and Turnstile keys. See [Next steps](#next-steps).
- Nothing is deployed yet. Production setup is Phase 8.

## Roadmap status

| Phase | What                                                                        | Status                       | PR  |
| ----- | --------------------------------------------------------------------------- | ---------------------------- | --- |
| 0     | Foundation: project setup, design system, env, linting                      | ✅ Done                      | #1  |
| 1     | Database: schema, RLS, booking functions, storage, seed, types              | ✅ Done, pushed to dev DB    | #2  |
| 2     | Admin auth: login, route protection, admin shell, create-admin script       | ✅ Done, real login verified | #3  |
| 3     | Admin content: services, availability, portfolio, settings, account         | ✅ Done                      | #4  |
| 4     | Public site: home, services, portfolio, about, contact, 404, hero animation | ✅ Done                      | #5  |
| 5     | Booking flow + admin calendar, staff bookings, payments, emails             | ✅ Built, needs owner keys   | —   |
| 6     | Admin: dashboard stats, bookings table, clients, reschedule, privacy        | ⏳ Next                      |     |
| 7     | Hardening: security headers, accessibility, performance, SEO, sitemap       | Not started                  |     |
| 8     | Deploy: Vercel + production Supabase                                        | Not started                  |     |

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
- **Emails (Resend):** booking received, booking confirmed, declined/cancelled to the client; "new booking needs review" to the studio email in Settings.

## How it's verified

| Check                 | Command                                                         | Last result                                                |
| --------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| Full project check    | `npm run check` (typecheck, lint, SQL parse, unit tests, build) | ✅ passing                                                 |
| Database rules        | `npm run test:db` (needs `DATABASE_URL_TEST`)                   | ✅ passing against the dev project                         |
| Public site (browser) | `npm run test:e2e -- e2e/public-site.spec.ts`                   | ✅ passing on desktop and phone (Pixel 7), touch included  |
| Admin flows (browser) | `e2e/admin-content.spec.ts` (needs an admin login, see below)   | ✅ passing, includes public-page refresh after edits       |
| Booking (browser)     | `e2e/booking.spec.ts`, `e2e/admin-bookings.spec.ts`             | ✅ wizard up to payment; staff booking, share, pay, cancel |

The admin e2e tests need `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`. Use a **temporary** admin account, delete it afterwards, and never use the owner account. The tests clean up what they create: services named `E2E Package…`, photos with alt text `E2E photo…` and blackouts with reason `E2E test…`. Booking tests leave cancelled bookings named `E2E Client…`; delete those (and their payments and clients) after a run.

## Environments and accounts

- **Supabase dev project:** ref `mkpjxrhjynbjuiovloiy`, hosted (no local Docker). All migrations and the seed are applied.
- **Owner admin account:** exists on the dev project. Credentials are held by the studio owner and are never written in the repo.
- **GitHub:** `lightchasersstudio-web/LightChasersStudio`. Work goes on one branch and one PR per phase, merged into `main`.
- **Not set up yet:** production Supabase, Vercel, PayMongo, Resend (email) and Cloudflare Turnstile. Without their keys: emails are skipped, Turnstile is skipped in development only (production refuses bookings), and online booking says payment isn't available yet.

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
- **The GitHub CLI (`gh`) isn't installed** on the main dev machine, so PRs are opened from the GitHub website.

## Next steps

**Finish Phase 5 (needs the owner):**

1. Add the keys to `.env.local` (see `docs/SETUP.md`): PayMongo **test** secret key, Turnstile site key + secret, Resend API key + `EMAIL_FROM`.
2. Register the PayMongo webhook at `<site>/api/webhooks/paymongo` for `checkout_session.payment.paid` and put its secret in `PAYMONGO_WEBHOOK_SECRET`. Locally this needs a tunnel (or test on a Vercel preview).
3. Make one test booking and check: the webhook marks it paid, the client and studio emails arrive, and `parsePaidEvent` matches the real payload.
4. Add the Versa Space rental package(s) and real prices, plus the deposit and cancellation/refund wording.

**Phase 6:** dashboard stats, searchable bookings table, clients list with history, rescheduling, and the privacy anonymisation routine.
