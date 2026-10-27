# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Booking website for **Light Chasers Studio**, a photography business in Zamboanga City, Philippines. It covers weddings & prenup, portraits & family, events, and product/commercial shoots. Timezone `Asia/Manila`, currency PHP, privacy law: Philippines Data Privacy Act of 2012 (RA 10173).

- **Public side:** no login. Clients fill in a client-info form, then book through a multi-step wizard and **pay a deposit via PayMongo** (GCash etc.) to hold the slot.
- **Admin side (`/admin`):** the only authenticated area, using Supabase Auth email/password. There is no public sign-up.

The full product spec, data model, security rules and build roadmap are in `docs/master-prompt.md`. Read the relevant section before starting a phase. Work proceeds **phase by phase**: plan each feature, finish and verify a phase, then move on.

Current progress:

- **Phase 0 (foundation):** done, including the brand design system (see Design system below).
- **Phase 1 (database):** done. Migrations and seed are pushed to the hosted dev project (`mkpjxrhjynbjuiovloiy`), `npm run test:db` passes against it, and `src/types/database.types.ts` is generated.
- **Phase 2 (admin auth):** login, `proxy.ts`, the admin gate, the admin shell and the create-admin script are built. Sign-in with the real owner account is verified on the dev project.
- **Phase 3 (admin content):** done. Services CRUD (cover photo, ordering, on/off), weekly hours + blackout dates, portfolio uploads (multi-photo, featured, ordering), studio profile/logo/booking rules, and an Account page to change password. Covered by unit tests, `npm run test:db`, and `e2e/admin-content.spec.ts` (needs `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`).
- **Phase 4 (public site):** done. Home, services list + detail, portfolio (filters + lightbox), about, contact (live opening hours), branded 404. All public pages are static and refreshed by admin edits through cache tags.
- **Phase 5 (booking flow + calendars):** built; payments/emails/Turnstile wait on the owner's keys. Design: `docs/superpowers/specs/2026-10-15-booking-calendar-design.md`.
  - Public: "Book now" everywhere (`bookHref(slug)` in `site-nav.ts` preselects a package); wizard `/book` (details → package → month calendar + times → shoot details → review → PayMongo deposit), `/book/done`, `/book/cancelled` (retry while held), `/booking` (lookup by reference + email). Portfolio photos can link to a package ("Book this package"). Versa Space = `studio` category (studio rental).
  - Admin: `/admin/calendar` (month grid + day timeline with a "free" lane), `/admin/bookings/new` (staff booking: confirmed at once, email optional, custom price, GCash/cash/pay-at-shoot, outside-hours needs "Book anyway"), `/admin/bookings/[id]` (contact buttons incl. Messenger, booking card + copy-as-text, confirm/decline/complete/cancel, record payment, notes, resend email, late-payment review banner). Settings → "Shoots that can run at the same time".
  - Since then (merged from `front-end-extras`): add-ons, VAT (`business_settings.vat_percent`, default 12; `src/lib/booking/pricing.ts` mirrors `create_booking`), reviews, FAQ, sales report, dashboard, draft save, and **trial mode** (`PAYMENTS_MOCK=true`: pretend checkout `/book/mock-checkout`, email previews `/admin/trial-emails`; ignored when `VERCEL_ENV=production`, see `src/lib/payments/mock.ts`). Paying in trial mode and the PayMongo webhook share `src/server/settle-payment.ts`.
  - **One booking per time slot** (owner decision 2026-10-17): `max_concurrent_bookings` = 1 (migration `20261017000100`). The wizard steps are browser-history entries, so Back moves between steps; its Continue/Submit buttons need distinct `key`s (else the click submits and skips Review).
  - **Email:** `sendEmail` (`src/lib/email/send.ts`) sends from the studio Gmail via nodemailer when `GMAIL_USER` + `GMAIL_APP_PASSWORD` are set (even in trial mode, so pretend payments email real inboxes), else Resend. The studio has no domain, so Resend can't reach clients.
  - Without keys: emails are skipped (logged), Turnstile is skipped in dev only (production refuses), online booking says payment isn't available. The PayMongo event parser (`parsePaidEvent`) still needs confirming against a real test-mode delivery.
- **Package lengths + add-on rules** (owner decision 2026-10-19, migration `20261019000100`): only packages with a set length (`services.duration_minutes`, nullable; the Photobooth = 4 h) have an end time. Others are a start time only: they hold one slot (`slot_interval_minutes` + buffer) and `bookings.has_end_time = false`. Add-ons can add time (`add_ons.extra_minutes`, photobooth extensions) and be limited to packages (`add_ons.service_ids`, empty = all; enforced in `create_booking`). Mirrors: `src/lib/booking/package-length.ts`. Up to 10,000 people per booking.
- **Sales report:** real data (`src/server/queries/reports.ts` + `src/lib/reports/sales.ts`): bookings that are paid/confirmed/done by shoot month at their total incl. VAT; "how clients paid" = money received by payment date. Sample photos for the dev site: `npm run data:sample-photos` (`-- --remove` before go-live).
- **Workshop (base, 2026-10-27; the other developer extends it):** a package with category `workshop` (migrations `20261027000100/200`), booked through the same wizard and calendar at `/workshop` from a left-hand floating button (`site-workshop.tsx`). Hidden from public package lists (`listActiveServices`/`getActiveServiceBySlug` exclude it; `getActiveWorkshop()`), edited in Admin → Services (`PACKAGE_CATEGORIES` in `src/lib/catalog.ts`; public menus keep `SERVICE_CATEGORIES`). The client pays half or in full: `create_booking(p_pay_in_full)` (required for workshops, raises `payment_option_required`), mirrored by `bookingTotals({ payInFull })`; paid in full = `deposit_cents = price_cents`. Refund rule (owner's): paid half = no refund for a no-show, paid in full = half back, by hand; `workshopRefundCents` in `src/lib/booking/workshop.ts` drives the note on the admin booking page. The wizard requires accepting the rule (`refundRuleAccepted`).
- **Booking management:** done. `/admin/bookings/[id]/edit` (time, package, price, add-ons, VAT, details; optional "updated" email), History panel (audit log), owner-only permanent delete (refused if a real payment exists), monthly CSV at `/admin/reports/export?month=YYYY-MM`. Dev DB cleanup: `npm run data:clean-tests`; go-live catalog copy: `scripts/copy-catalog.mjs`. Data rules in `docs/HANDOFF.md` → Managing data.

## Commands

```bash
npm run dev            # dev server (Turbopack)
npm run check          # typecheck + lint + db:lint + unit tests + build — run before calling anything done
npm run typecheck      # next typegen && tsc (typegen creates global LayoutProps/PageProps types)
npm run lint
npm run format         # prettier (with tailwind class sorting)
npm test               # vitest, all unit tests
npx vitest run src/lib/env.test.ts        # single test file
npx vitest run -t "requires the service"  # single test by name
npm run test:e2e       # playwright (first time: npx playwright install chromium)
npx playwright test e2e/smoke.spec.ts --project=chromium
npx shadcn@latest add <component>         # add shadcn components into src/components/ui
npm run db:lint        # parse all migrations + seed with the real Postgres parser (no DB needed)
npm run db:push        # apply supabase/migrations to the linked hosted project (db:push:seed also runs seed.sql)
npm run db:types       # regenerate src/types/database.types.ts from the linked project
npm run test:db        # DB tests (RLS, create_booking, overlap) against DATABASE_URL_TEST; skipped if unset
npm run admin:create -- owner@example.com "Full Name" owner   # create/promote an admin (service role, .env.local)
npm run data:clean-tests              # remove E2E test rows from the DEV db (-- --all-bookings wipes all dev bookings; refuses non-dev)
```

Supabase runs as a **hosted dev project**, not locally (no Docker on this machine). Link it once with `npx supabase login` and `npx supabase link --project-ref <ref>`. All schema changes go in SQL files in `supabase/migrations/`, never as dashboard-only edits. PGlite can't run on this machine (not enough free RAM), which is why there's no in-process database. DB tests use a real connection, and each runs in a transaction that is rolled back.

## Stack specifics (newer than you may expect)

- **Next.js 16** with App Router and React 19. Read `node_modules/next/dist/docs/` before using an unfamiliar API (see AGENTS.md).
  - Middleware is now **`src/proxy.ts`**, which exports `proxy`. Use it only for optimistic redirects and Supabase session refresh. Real authorization is re-checked in every admin page and server action.
  - **`cacheComponents: true`** is enabled. Pages are prerendered by default, and dynamic data (`cookies()`, `headers()`, uncached fetches) must sit inside `<Suspense>` or be cached with `"use cache"`. Check the cache-components docs before writing data-fetching pages.
- **Tailwind v4**, configured in CSS. Theme tokens live in `src/app/globals.css` (`:root` / `.dark` variables mapped through `@theme inline`). There is no `tailwind.config`.
- **shadcn/ui**: `radix-nova` style, components in `src/components/ui`. For forms use the **`field`** component (`Field`, `FieldLabel`, `FieldError`, …) with react-hook-form `Controller` plus a zod resolver. The old `form` component is empty in this style.
- **zod v4** (`z.url()`, `z.email()` are top-level), date-fns v4 with **`@date-fns/tz`** (`TZDate`) for timezone work, lucide-react, next-themes (class strategy, light by default, with a dark toggle).

## Architecture

- Route groups: `src/app/(public)` holds marketing pages and the booking wizard; `src/app/(admin)/admin` holds the admin area. Each has its own layout.
- Admin auth has three layers:
  1. `src/proxy.ts` (matcher `/admin/*`) refreshes the session and redirects signed-out visitors to `/admin/login?next=…`.
  2. `src/app/(admin)/admin/(protected)/layout.tsx` runs `requireAdmin()` inside `<Suspense>` and renders children only after it passes.
  3. **Every admin page calls `requireAdmin()`, and every admin server action calls `assertAdmin()`** (both in `src/server/auth.ts`, using `getClaims()` plus a lookup in `admin_profiles`). Layouts don't re-run on client navigation, so the page and action checks are mandatory.
- New admin pages go under `(protected)/`, and their nav entries go in `src/components/admin/admin-nav.ts`. The login page lives outside `(protected)` to avoid a redirect loop.
- Login runs in the browser (`signInWithPassword`) so that Supabase's per-IP rate limit sees the real client IP. Post-login redirects go through `safeAdminRedirect()`, which only allows `/admin` paths. Non-admin sessions are sent to `/admin/login?error=forbidden`, which offers a sign-out button.
- Supabase clients in `src/lib/supabase/`:
  - `server.ts`: cookie-based, acts as the user, so RLS applies.
  - `browser.ts`: anon key.
  - `admin.ts`: **service role, bypasses RLS**. Only for trusted server code such as webhooks, and only after checking authorization.
- Env vars are validated with zod:
  - `src/lib/env.ts` holds public vars only, safe to import anywhere.
  - `src/lib/env.server.ts` holds secrets and is marked `server-only`. Every var is documented in `.env.example`.
  - Never read secrets anywhere else or give them a `NEXT_PUBLIC_` prefix.
- Data access lives in `src/server/queries/`, mutations in `src/server/actions/` (Server Actions returning `{ ok: true, data } | { ok: false, error }`), and zod schemas in `src/lib/validations/`, shared by client and server and always re-validated on the server.
- Payments: `src/lib/payments/` (PayMongo, called via `fetch`) and the webhook at `src/app/api/webhooks/paymongo/route.ts`.
- **Admin server actions** go through `adminAction(schema, input, fn)` in `src/server/admin-action.ts`: it calls `assertAdmin()`, re-validates with the shared zod schema (field errors come back to the form via `handleResult()` in `src/components/admin/form-utils.ts`), and catches unexpected errors. After a write, call `audit(...)` and `revalidate(TAGS.x)` (`updateTag` + `refresh`). Phase 4's public `"use cache"` queries must `cacheTag()` with the same `TAGS` so admin edits show up immediately.
- **Admin forms** keep inputs as strings; zod schemas in `src/lib/validations/` transform them into DB rows (pesos → centavos via `src/lib/utils/money.ts`). Use the wrappers in `src/components/admin/form-fields.tsx`.
- **Image uploads** happen in the browser (`src/lib/images/prepare-image.ts`): resize, re-encode to WebP (strips EXIF/GPS), make a blur placeholder, upload straight to Storage under admin RLS, then a server action saves the path. Actions only accept paths matching `STORAGE_PATH` in `src/lib/storage.ts`; build URLs with `publicImageUrl()`.
- **Public data** lives in `src/server/queries/public.ts`: `"use cache"` + `cacheTag(TAGS.x)` + `cacheLife("days")`, using the cookie-free anon client `src/lib/supabase/public.ts` (never `cookies()` inside a cache scope).
- **Dynamic public routes** (e.g. `/services/[slug]`) must read `params` **inside `<Suspense>`** (Partial Prefetching); reading them at the top level breaks regeneration after an admin edit (500). `generateStaticParams` must return at least one entry. Client components calling `usePathname()` in shared layouts need a `<Suspense>` wrapper too (see `nav-links.tsx`). Unknown slugs are soft 404s (200 + `noindex`).
- **Admin pages render their static header at once and put `requireAdmin()` + data (and any `params`/`searchParams` read) in a child inside `<Suspense>` with a skeleton from `src/components/admin/skeletons.tsx`** (use `<AdminOnly>` when a page has no data). Awaiting at the page top makes client navigation block (dev "uncached data during a navigation" insight). Forms seeded from the URL get a `key` so a new link remounts them.
- `requireAdmin()` calls `await connection()` first; without it Next flags the Supabase client's `Date.now()` during runtime prefetch.
- Vitest stubs `server-only` (`src/test/server-only-stub.ts`), so server modules can be unit-tested.

### Database conventions (Phase 1)

- Money is stored as integer **centavos** in `*_cents` columns (₱1 = 100). Images are stored as Storage **paths** (`cover_image_path`, `storage_path`, `logo_path`) in the public `portfolio` and `brand` buckets, never as full URLs.
- `business_settings` is a single row (`id = true`) holding the timezone and booking rules: notice, advance window, slot interval, buffer, default deposit %, and hold minutes.
- Functions are `SECURITY DEFINER` with `set search_path = ''` and fully qualified names. Every new function must `revoke execute ... from public` and then grant only the roles that need it, because Supabase grants anon execute by default.
- `create_booking` is **service-role only**. Call it through the admin client from a server action, after Turnstile and rate limiting. It raises P0001 with one of these messages: `service_unavailable`, `invalid_start_time`, `too_soon`, `too_far`, `blackout_date`, `outside_business_hours`, `slot_unavailable`, `email_required`. Map them with `src/lib/booking/booking-errors.ts`.
- `admin_create_booking` / `admin_update_booking` / `delete_booking` (service role, after `assertAdmin`; delete is owner-only in the action), `mark_booking_paid` (webhook only, idempotent per payment id) and `hit_rate_limit` (Postgres fixed-window limiter, used by `src/lib/rate-limit.ts`) are the other booking RPCs. `clients.email` is nullable (staff bookings); public bookings still require it.
- `get_busy_ranges(from, to)` is callable by anon, returns no personal data, and accepts at most a 62-day window. It feeds the public slot picker together with `availability_rules` and `blackout_dates`.
- Public bookings never overwrite an existing `clients` row; clients are matched by lowercased email. Each booking stores the contact name and phone as submitted.
- Bookings, payments and clients use `on delete restrict`. Privacy deletion requests need an anonymisation routine (Phase 6).
- A trigger enforces booking status transitions.

### Booking & payment design (decided; implement in Phases 5 and 5b)

- Status flow: `pending_payment → pending` (deposit paid, awaiting admin) `→ confirmed → completed`, plus `cancelled`, `declined` and `expired`.
- **Capacity, enforced in Postgres:** up to `business_settings.max_concurrent_bookings` shoots may run at once. Every booking path calls `assert_capacity(start, blocked_until)`, which takes a transaction-wide advisory lock and checks the peak number of blocking bookings that actually coincide in the range (`blocked_until` = end + buffer). The old exclusion constraint is gone. `src/lib/booking/slots.ts` mirrors the rule for the calendars.
- Unpaid bookings hold the slot until `hold_expires_at` (15–30 min). The constraint can't use `now()`, so stale holds are expired by a pg_cron job **and** at the start of the `create_booking` SECURITY DEFINER RPC. That RPC inserts the client and booking atomically, because anon users have no direct access to `clients` or `bookings`.
- Prices and `deposit_cents` are always computed on the server from `services`, never taken from the client.
- A booking counts as paid **only through a signature-verified, idempotent PayMongo webhook** (`src/app/api/webhooks/paymongo/route.ts`, event `checkout_session.payment.paid`), never through the success redirect. A payment arriving after the hold lapsed is kept; if the slot filled meanwhile the booking is flagged `needs_refund_review`.

## Design system

Load the `ui-ux-pro-max` skill before creating or changing UI. The vibe is a cute, warm, modern photo studio. Tokens live in `src/app/globals.css`; components use tokens, never raw hex.

- **Colours** (from `public/brand/logo.jpg`): Evergreen `#455D5A` (`primary`), Terracotta `#CE7056` (`terracotta`; decoration and large text only, ~3.4:1, so use `terracotta-ink` `#A8513A` for text), Sage `#91C099` (`sage`; tints, always with dark text), Blush `#F8E6DF` (`accent`/`blush`). Background ivory `#FAF8F4` light / `#141A19` dark; in dark mode `primary` becomes sage with dark text.
- **Type** (`next/font` in `src/app/layout.tsx`): Fraunces with the SOFT axis for h1–h3 (`font-heading`, applied automatically), Nunito Sans for body (`font-sans`), Caveat for short handwritten accents only (`font-script`, e.g. "say cheese!"). The script wordmark appears only as the logo image.
- **Shape:** `--radius: 1rem`, pill buttons (`rounded-full`), 44px touch targets (button `default` h-10, `lg` h-11; inputs h-11).
- **Photo motifs** (CSS utilities in `globals.css`): `polaroid` (white frame with a deep bottom), `viewfinder` (terracotta corner brackets), `bg-studio` (blush/sage glow over a dot grid), plus `<Sparkle />` (`src/components/shared/sparkle.tsx`, the four-point star from the logo). The logo JPG has a white background, so show it on white (a polaroid) or with `mix-blend-multiply` in light mode.
- Editorial, photo-first, mobile-first, WCAG 2.1 AA, `prefers-reduced-motion` respected globally, always `next/image`.
- **Motion** (`motion/react`, formerly Framer Motion) for gesture/physics animation, e.g. the swipeable hero stack (`src/components/public/hero-deck.tsx`). Wrap in `<MotionConfig reducedMotion="user">`; simple entrances stay as Tailwind `animate-in` classes.

## Conventions

- kebab-case filenames (enforced by ESLint), PascalCase components, no `any`, Server Components by default with `"use client"` at the leaves.
- RLS on every table. Admin role comes from `admin_profiles`, never from a client-supplied flag. Booking lookup needs reference code **and** email.
- On Windows: both PowerShell and Git Bash are available.
