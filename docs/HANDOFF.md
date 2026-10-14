# Handoff: Light Chasers Studio booking site

_Last updated: 2026-10-14, at the end of Phase 4._

This document says where the project stands: what's built, what's verified, what's left, and the decisions and limits a new person needs to know. For first-time setup on a new machine, see [`SETUP.md`](SETUP.md). For the full product spec and roadmap, see [`master-prompt.md`](master-prompt.md). For coding rules and architecture notes, see [`../CLAUDE.md`](../CLAUDE.md).

## The project in one paragraph

A booking website for **Light Chasers Studio**, a photography studio in Zamboanga City (weddings & prenups, portraits & family, events, product shoots). Visitors browse services and the portfolio without logging in. In Phase 5 they will book a time slot and pay a deposit through PayMongo (GCash and others). Staff manage everything from an admin area at `/admin`, which is the only part that needs a login. Built with Next.js 16, Tailwind v4, shadcn/ui and Supabase (Postgres, Auth, Storage).

## Where we left off

- **Phases 0–4 are built and verified.** Phase 4 (public site) is on branch `phase-4-public-site`, with a PR open against `main`.
- **Next up: Phase 5, the booking flow.** See [Next steps](#next-steps).
- Nothing is deployed yet. Production setup is Phase 8.

## Roadmap status

| Phase | What                                                                        | Status                       | PR  |
| ----- | --------------------------------------------------------------------------- | ---------------------------- | --- |
| 0     | Foundation: project setup, design system, env, linting                      | ✅ Done                      | #1  |
| 1     | Database: schema, RLS, booking functions, storage, seed, types              | ✅ Done, pushed to dev DB    | #2  |
| 2     | Admin auth: login, route protection, admin shell, create-admin script       | ✅ Done, real login verified | #3  |
| 3     | Admin content: services, availability, portfolio, settings, account         | ✅ Done                      | #4  |
| 4     | Public site: home, services, portfolio, about, contact, 404, hero animation | ✅ Done, PR open             | —   |
| 5     | Booking flow: wizard, time slots, PayMongo deposit, Turnstile, emails       | ⏳ Next                      |     |
| 6     | Admin booking management: dashboard, bookings, calendar, clients, audit log | Not started                  |     |
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
- **"Book a session" currently links to `/contact`.** Phase 5 switches it to `/book`; it's a one-line change in `src/components/public/site-nav.ts`.

## How it's verified

| Check                 | Command                                                         | Last result                                               |
| --------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| Full project check    | `npm run check` (typecheck, lint, SQL parse, unit tests, build) | ✅ passing, 34 unit tests                                 |
| Database rules        | `npm run test:db` (needs `DATABASE_URL_TEST`)                   | ✅ passing against the dev project                        |
| Public site (browser) | `npm run test:e2e -- e2e/public-site.spec.ts`                   | ✅ passing on desktop and phone (Pixel 7), touch included |
| Admin flows (browser) | `e2e/admin-content.spec.ts` (needs an admin login, see below)   | ✅ passing, includes public-page refresh after edits      |

The admin e2e tests need `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`. Use a **temporary** admin account, delete it afterwards, and never use the owner account. The tests clean up what they create: services named `E2E Package…`, photos with alt text `E2E photo…` and blackouts with reason `E2E test…`.

## Environments and accounts

- **Supabase dev project:** ref `mkpjxrhjynbjuiovloiy`, hosted (no local Docker). All migrations and the seed are applied.
- **Owner admin account:** exists on the dev project. Credentials are held by the studio owner and are never written in the repo.
- **GitHub:** `lightchasersstudio-web/LightChasersStudio`. Work goes on one branch and one PR per phase, merged into `main`.
- **Not set up yet:** production Supabase, Vercel, PayMongo, Resend (email) and Cloudflare Turnstile. Their env vars are optional in code until Phase 5.

## Key decisions (don't undo these without a reason)

- **Money is stored as integer centavos** (`*_cents` columns, ₱1 = 100). Prices and deposits are always calculated on the server, never taken from the browser.
- **A booking counts as paid only through a signature-verified PayMongo webhook**, never through the "payment success" redirect.
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
- **The GitHub CLI (`gh`) isn't installed** on the main dev machine, so PRs are opened from the GitHub website.

## Next steps

**Phase 5: booking flow.** Read the "Booking" sections of `docs/master-prompt.md` and the booking notes in `CLAUDE.md` first.

1. Build a multi-step wizard at `/book`: client info → service → date and time → details → review → confirmation.
2. Build the slot picker from `availability_rules`, `blackout_dates` and `get_busy_ranges()`. Use the Asia/Manila timezone throughout.
3. Add a server action that checks Cloudflare Turnstile, applies rate limiting, then calls `create_booking` through the service-role client. Map its error codes to friendly messages.
4. PayMongo checkout for the deposit, plus the webhook at `src/app/api/webhooks/paymongo/route.ts`. It must verify the signature and be safe to receive twice. Check PayMongo's current docs for field names first.
5. Confirmation emails through Resend.
6. Switch `BOOK_HREF` in `src/components/public/site-nav.ts` to `/book`.
7. Add the PayMongo, Turnstile and Resend keys to `.env.local` and make them required in `src/lib/env.server.ts`.

**Before Phase 5 can be fully tested, the owner needs to provide:**

- PayMongo test keys
- A Cloudflare Turnstile site key and secret
- A Resend API key and a verified sender domain or address
- The real deposit rules and the cancellation/refund policy wording
