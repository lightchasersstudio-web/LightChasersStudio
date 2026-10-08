# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Booking website for **Light Chasers Studio**, a photography business in Zamboanga City, Philippines. It covers weddings & prenup, portraits & family, events, and product/commercial shoots. Timezone `Asia/Manila`, currency PHP, privacy law: Philippines Data Privacy Act of 2012 (RA 10173).

- **Public side:** no login. Clients fill in a client-info form, then book through a multi-step wizard and **pay a deposit via PayMongo** (GCash etc.) to hold the slot.
- **Admin side (`/admin`):** the only authenticated area, using Supabase Auth email/password. There is no public sign-up.

The full product spec, data model, security rules and build roadmap are in `docs/master-prompt.md`. Read the relevant section before starting a phase. Work proceeds **phase by phase**: plan each feature, finish and verify a phase, then move on.

Current progress:

- **Phase 0 (foundation):** done, except the brand design system (fonts, palette tokens), which waits on the `ui-ux-pro-max` skill being installed.
- **Phase 1 (database):** migrations, RLS, seed and DB tests are written. They haven't been pushed to a Supabase project yet, so `npm run test:db` hasn't run against a real database, and `src/types/database.types.ts` hasn't been generated.
- **Phase 2 (admin auth):** login, `proxy.ts`, the admin gate, the admin shell and the create-admin script are built. Signing in with a real account is untested until a Supabase project exists. The screens use plain shadcn styling, pending the brand design pass.

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
- Vitest stubs `server-only` (`src/test/server-only-stub.ts`), so server modules can be unit-tested.

### Database conventions (Phase 1)

- Money is stored as integer **centavos** in `*_cents` columns (₱1 = 100). Images are stored as Storage **paths** (`cover_image_path`, `storage_path`, `logo_path`) in the public `portfolio` and `brand` buckets, never as full URLs.
- `business_settings` is a single row (`id = true`) holding the timezone and booking rules: notice, advance window, slot interval, buffer, default deposit %, and hold minutes.
- Functions are `SECURITY DEFINER` with `set search_path = ''` and fully qualified names. Every new function must `revoke execute ... from public` and then grant only the roles that need it, because Supabase grants anon execute by default.
- `create_booking` is **service-role only**. Call it through the admin client from a server action, after Turnstile and rate limiting. It raises P0001 with one of these messages: `service_unavailable`, `invalid_start_time`, `too_soon`, `too_far`, `blackout_date`, `outside_business_hours`, `slot_unavailable`. Map them to user-facing text.
- `get_busy_ranges(from, to)` is callable by anon, returns no personal data, and accepts at most a 62-day window. It feeds the public slot picker together with `availability_rules` and `blackout_dates`.
- Public bookings never overwrite an existing `clients` row; clients are matched by lowercased email. Each booking stores the contact name and phone as submitted.
- Bookings, payments and clients use `on delete restrict`. Privacy deletion requests need an anonymisation routine (Phase 6).
- A trigger enforces booking status transitions.

### Booking & payment design (decided; implement in Phases 5 and 5b)

- Status flow: `pending_payment → pending` (deposit paid, awaiting admin) `→ confirmed → completed`, plus `cancelled`, `declined` and `expired`.
- **No double booking, enforced in Postgres:** a gist exclusion constraint on `tstzrange(start_at, blocked_until)` (where `blocked_until` is the end time plus the buffer), covering bookings not in `cancelled/declined/expired`.
- Unpaid bookings hold the slot until `hold_expires_at` (15–30 min). The constraint can't use `now()`, so stale holds are expired by a pg_cron job **and** at the start of the `create_booking` SECURITY DEFINER RPC. That RPC inserts the client and booking atomically, because anon users have no direct access to `clients` or `bookings`.
- Prices and `deposit_cents` are always computed on the server from `services`, never taken from the client.
- A booking counts as paid **only through a signature-verified, idempotent PayMongo webhook**, never through the success redirect. Check PayMongo's current docs for field names before implementing.

## Design system (provisional — confirm with `ui-ux-pro-max` before building UI)

Load the `ui-ux-pro-max` skill before creating or changing UI. Colours are sampled from the logo (`public/brand/logo.jpg`):

- Evergreen `#455D5A` (primary: text, buttons)
- Terracotta `#CE7056` (accent; large text and decoration only, since it is ~3.4:1 on white; use `#A8513A` for text)
- Sage `#91C099` (soft tints, always with dark text)
- Background: ivory `#FAF8F4` light / `#141A19` dark

Proposed type: Cormorant Garamond for headings, Inter for body text. The script wordmark appears only as the logo image. Editorial, photo-first, mobile-first, WCAG 2.1 AA, always `next/image`.

## Conventions

- kebab-case filenames (enforced by ESLint), PascalCase components, no `any`, Server Components by default with `"use client"` at the leaves.
- RLS on every table. Admin role comes from `admin_profiles`, never from a client-supplied flag. Booking lookup needs reference code **and** email.
- On Windows: both PowerShell and Git Bash are available.
