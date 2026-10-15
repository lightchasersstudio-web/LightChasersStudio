# Booking flow & calendars: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clients book and pay a deposit through a month-calendar wizard. Staff see every booking on an admin month calendar + day timeline, and can book clients in, share bookings and record payments. Several shoots can run at once.

**Architecture:**

- **Postgres owns the rules.** Capacity, hours, blackouts and notice are enforced in `SECURITY DEFINER` RPCs serialised by an advisory lock.
- **One pure TypeScript slot calculator** (`src/lib/booking/slots.ts`) feeds both calendars. It reads the same data the RPCs check.
- **Integrations via `fetch`:** PayMongo Checkout Sessions, Resend and Cloudflare Turnstile, each in a small module under `src/lib/`. When a key is missing, each degrades as described in Global Constraints.

**Tech Stack:** Next.js 16 (cacheComponents, Server Actions), Supabase Postgres/RLS, zod v4, react-hook-form, date-fns v4 + `@date-fns/tz`, Motion, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-booking-calendar-design.md`

**Owner additions after spec approval (2026-10-15):**

- (a) "Book a session" buttons become **"Book now"**.
- (b) Every "Book now" next to a specific package opens `/book?service=<slug>` with that package chosen. A portfolio photo linked to a package offers "Book this package". Otherwise the photo offers its category.
- (c) **Versa Space is a studio space rental.** It becomes a new category, `studio`, labelled **"Versa Space"**, after Portraits & family. The owner creates the actual rental package(s) and prices in Admin → Services. The home card links to `/services#studio`.

## Global Constraints

- **Timezone:** `Asia/Manila` everywhere (`BUSINESS_TZ`). Money is integer centavos.
- **No secrets** in `NEXT_PUBLIC_*`. The service-role client is only used after `assertAdmin()`, or in the webhook and the public booking action after Turnstile and the rate limit.
- **Every new DB function:**
  - `security definer set search_path = ''`, with fully qualified names.
  - `revoke execute ... from public, anon, authenticated`, then grant only the roles listed in its task.
- **Missing integration keys:**
  - Turnstile: verification is **skipped only when `NODE_ENV !== "production"`**; in production it fails closed.
  - PayMongo: the booking action refuses with "Online payment isn't available yet. Please contact us to book." **before** creating a booking.
  - Resend: emails are logged and skipped. A booking never fails because an email failed.
- **No Viber in any UI.** `contact_method` options shown: email, phone, sms, messenger.
- **Copy:** never invent policies. Review and email text mentions only facts in the DB: price, deposit, hold expiry, reference.
- **Status colours** come from the tokens:
  - Confirmed and completed: `sage`.
  - Pending: `terracotta`/`blush`.
  - Pending payment: dashed `muted`.
- **Phones:** every page works at 360px wide with no horizontal scroll, 44px touch targets, and `prefers-reduced-motion` respected.
- Run `npm run check` before each commit. **Commit only at the end** when the owner asks (project rule). Steps below say "checkpoint" instead of commit.

## Review Focus

1. **Two people booking the last free spot at the same time:** exactly one succeeds; the other sees "That time was just taken" and fresh slots. _Test: Task 2, concurrent RPC calls on two connections._
2. **Payment arrives after the hold expired** and the slot has since filled: the booking is not silently dropped. It becomes `pending` and is flagged `needs_refund_review`; the admin sees a warning. _Test: Task 2, `mark_booking_paid` on an expired booking at full capacity._
3. **The same PayMongo webhook delivered twice:** only one payment row, one status change, one email. _Test: Task 7, call the handler twice with the same event id._
4. **Overlaps that never coincide:** with capacity 2, bookings at 9–10 and 11–12 still allow a 9–12 booking. _Test: Task 2 SQL and Task 3 unit test._
5. **A Manila day boundary:** a slot at 23:30 UTC belongs to the next Manila day. A booking running past closing time isn't offered. _Test: Task 3._

---

### Task 1: "Book now" everywhere, per-package links, Versa Space category

**Files:**

- Create: `supabase/migrations/20261015000100_studio_category.sql`. Only `alter type public.service_category add value if not exists 'studio' after 'portrait';`, because enum values can't be used in the transaction that adds them.
- Create: `supabase/migrations/20261015000150_portfolio_service_link.sql`
  - `alter table public.portfolio_images add column service_id uuid references public.services(id) on delete set null;`
  - Plus an index.
- Modify:
  - `src/lib/catalog.ts`: add `{ value: "studio", label: "Versa Space" }` after portrait.
  - `src/components/public/site-nav.ts`:
    - `BOOK_HREF = "/book"`.
    - Add `bookHref(slug?: string) => slug ? \`/book?service=${slug}\` : "/book"`.
  - `src/app/(public)/page.tsx`:
    - `CATEGORY_ICONS.studio = HouseIcon`.
    - Remove the `SHOOT_CARDS` Versa special case. The categories now include it and link to `/services#studio`; keep the odd-count full-width rule.
  - All "Book a session"/"Book this session" labels: header, mobile nav, book-cta, home hero, service detail, about.
  - `service-card.tsx`: add a "Book now" link to `bookHref(slug)`.
  - `services/[slug]/page.tsx`: "Book now" → `bookHref(slug)`.
  - `portfolio-gallery.tsx` lightbox:
    - "Book this package" → `bookHref(service.slug)` when the photo has an active `service_id`.
    - Otherwise "Book a {category} shoot" → `/services#{category}`.
  - Admin portfolio edit: a "Package shown (optional)" select. `updatePortfolioImageSchema` gets `serviceId: z.uuid().nullable()`.
  - `src/server/queries/public.ts`: `listPortfolio`/`listFeaturedPhotos` select `*, service:services(slug,name,is_active)`.
  - `e2e/public-site.spec.ts`: "Book a session" → "Book now".
- Test: `src/lib/catalog.test.ts`. `bookHref("prenup-session")` returns `"/book?service=prenup-session"`, and `bookHref()` returns `"/book"`.

- [ ] Write the failing `bookHref` test, run `npx vitest run src/lib/catalog.test.ts`, and expect FAIL.
- [ ] Implement it; the test passes.
- [ ] Apply both migrations with `npm run db:push`, then run `npm run db:types`. Expect `service_category` to include `"studio"` and `portfolio_images.service_id` to exist.
- [ ] Make the code changes above. Run `npm run typecheck`; expect PASS (the `Record<ServiceCategory, Icon>` maps force every category to be handled).
- [ ] Checkpoint.

### Task 2: Database: capacity, admin bookings, manual payments, webhook settlement, rate limit

**Files:**

- Create: `supabase/migrations/20261015000200_booking_capacity.sql`
- Modify: `supabase/tests/database.test.ts`. Update the overlap test to capacity semantics, and add the tests below.

**Schema:**

- `business_settings.max_concurrent_bookings int not null default 2 check (between 1 and 10)`.
- `bookings`:
  - `messenger text check (char_length(messenger) <= 300)`.
  - `source text not null default 'online' check (source in ('online','admin'))`.
  - `needs_refund_review boolean not null default false`.
- **Drop** constraint `bookings_no_overlap`, and add a gist index on `tstzrange(start_at, blocked_until)` for the overlap scan.
- `clients.email`: drop not null; the check becomes `email is null or (char_length(...) and like ...)`.
- `payments`:
  - `check (provider in ('paymongo','gcash','cash'))`.
  - `reference text check (char_length(reference) <= 100)`.
  - `recorded_by uuid references auth.users(id)`.
- `rate_limits(key text primary key, window_start timestamptz not null, hits int not null)`. RLS on, no policies.

**Functions:**

| Function           | Signature                                                                                                                                                         | Who may run it       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Capacity check     | `public.assert_capacity(p_start timestamptz, p_blocked_until timestamptz, p_exclude uuid default null)`                                                           | internal (no grants) |
| Public booking     | `public.create_booking(..., p_messenger text default null)`                                                                                                       | `service_role`       |
| Admin booking      | `public.admin_create_booking(...)`                                                                                                                                | `service_role`       |
| Webhook settlement | `public.mark_booking_paid(p_reference text, p_checkout_id text, p_payment_id text, p_amount_cents int, p_raw jsonb) returns table(booking_id uuid, outcome text)` | `service_role`       |
| Rate limit         | `public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int) returns boolean` (true = allowed)                                                           | `service_role`       |

- **`assert_capacity`:**
  - Takes `pg_advisory_xact_lock(4242001)`.
  - Raises `slot_unavailable` if `1 + max concurrent blocking bookings within [p_start, p_blocked_until) > max_concurrent_bookings`.
  - Blocking = status in (`pending`, `confirmed`, `completed`), or `pending_payment` with `hold_expires_at > now()`.
  - Max concurrency algorithm: for each candidate point `t` in `{p_start} ∪ {b.start_at of overlapping bookings with start_at > p_start}`, count overlapping bookings with `start_at <= t and blocked_until > t`. Take the max (0 if none).
- **`create_booking`:** replace it with the same parameters plus `p_messenger text default null`, appended last. Same checks; it calls `assert_capacity` before the insert instead of catching `exclusion_violation`. Drop the old signature first.
- **`admin_create_booking` parameters:**

  ```
  p_full_name text, p_email text, p_phone text,
  p_preferred_contact contact_method, p_messenger text,
  p_service_id uuid, p_start_at timestamptz, p_price_cents int,
  p_allow_outside_hours boolean, p_location text,
  p_participants int, p_special_requests text,
  p_payment_provider text, p_payment_amount_cents int,
  p_payment_reference text, p_admin_id uuid
  ```

  It returns `table(booking_id uuid, reference_code text)`.
  - Service may be inactive.
  - Slot alignment is checked.
  - Hours and blackout are checked only when `not p_allow_outside_hours`.
  - Always calls `assert_capacity`.
  - Status `confirmed`, `source 'admin'`.
  - Deposit = (service deposit_cents if set, else `round(p_price_cents * default_deposit_percent/100)`), capped at `p_price_cents`.
  - Consent version `'admin-2026-10'`.
  - Client: if an email is given, reuse it via `on conflict` without overwriting; otherwise insert a new client.
  - When `p_payment_provider` and an amount > 0 are given, insert a payment with `status 'paid'`, `paid_at now()` and `recorded_by p_admin_id`.

- **`mark_booking_paid`:**
  - Idempotent: if a payment with `provider_payment_id = p_payment_id` exists, return `'duplicate'`.
  - Find the booking by `reference_code`.
  - Upsert the payment on `provider_checkout_id`: status paid, amount, `paid_at`, raw.
  - Outcome:
    - Booking `pending_payment` → `pending`, outcome `'paid'`.
    - Booking `expired` → try `assert_capacity` excluding itself. If OK, set `pending` (`'paid_late'`). On `slot_unavailable`, set `pending` + `needs_refund_review = true` (`'needs_review'`).
    - Any other status: payment recorded, outcome `'already_settled'`.
  - Settling an expired booking over capacity is deliberate: money is never dropped, and the admin decides. To let that update through, `pending` must stay in the transition trigger's allowed `expired → pending`; it already is.
- **`hit_rate_limit`:** upsert-increment within the window, resetting when it has elapsed.
- Remove the old exclusion-violation handling from the status trigger comment.

**DB tests (in `describe("capacity")`, etc.):**

```ts
it("allows up to max_concurrent_bookings at the same time", ...)       // cap 2: 2 ok, 3rd -> slot_unavailable
it("counts only bookings that actually coincide", ...)                   // cap 2: 9-10 + 11-12 exist; 9-12 ok; another 9-12 -> slot_unavailable
it("serialises concurrent bookings for the last spot", ...)             // two pool connections, Promise.allSettled -> exactly 1 fulfilled
it("admin_create_booking skips notice, enforces capacity, warns on hours", ...) // tomorrow ok; 21:00 -> outside_business_hours unless allow=true; over cap -> slot_unavailable
it("admin bookings work without an email and record a cash payment", ...)
it("mark_booking_paid is idempotent and flags late payments over capacity", ...)
it("anon/authenticated cannot execute the new functions", ...)           // admin_create_booking, mark_booking_paid, hit_rate_limit, assert_capacity
it("hit_rate_limit allows N then blocks", ...)
```

- [ ] Write the tests; run `npm run test:db`; expect FAIL (functions are missing).
- [ ] Write the migration. `npm run db:lint` passes, then `npm run db:push` and `npm run db:types`.
- [ ] Run `npm run test:db`; expect all PASS, including the existing RLS tests.
- [ ] Checkpoint.

### Task 3: Slot calculator (pure)

**Files:**

- Create: `src/lib/booking/slots.ts` and `src/lib/booking/slots.test.ts`.

**Interfaces (produces):**

```ts
export type SlotRules = {
  durationMinutes: number;
  bufferMinutes: number;
  slotIntervalMinutes: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
  capacity: number;
  ignoreWindow?: boolean; // admin: skip notice/advance
};
export type WeeklyWindow = { day: number; start: string; end: string }; // "HH:MM", day 0=Sun
export type BusyRange = { start: Date; end: Date }; // end = blocked_until
export type DaySlots = { date: string; slots: Date[]; status: "open" | "few" | "full" | "closed" };
export function monthSlots(
  month: string /* "YYYY-MM" */,
  rules: SlotRules,
  hours: WeeklyWindow[],
  blackouts: string[] /* "YYYY-MM-DD" */,
  busy: BusyRange[],
  now: Date,
): DaySlots[];
export function occupancyAt(busy: BusyRange[], start: Date, end: Date): number; // max coinciding
```

- `"few"` = 1–2 slots left.
- `"full"` = an open day whose slots are all taken, or that's past the window.
- `"closed"` = no hours, or a blackout.
- A slot fits when `[start, start+duration]` lies inside one window and `occupancyAt(busy, start, start+duration+buffer) < capacity`.

**Tests:** cap 1 vs 2, the coinciding rule, buffer, notice cut-off, advance cut-off, blackout, a slot that would run past closing, the Manila day boundary (`now` given in UTC), and `ignoreWindow`.

- [ ] Write the tests and expect FAIL. Implement. `npx vitest run src/lib/booking` passes.
- [ ] Checkpoint.

### Task 4: Availability loading + `MonthCalendar` component

**Files:**

- Create: `src/server/queries/availability-slots.ts`
  - `loadMonthAvailability(serviceId: string, month: string, opts?: { admin?: boolean }): Promise<DaySlots[]>`.
  - Reads the service, settings, hours, blackouts and `get_busy_ranges` for the month ±1 day. Uses the public client normally, and the cookie client when `admin` is set.
- Create: `src/server/actions/availability-slots.ts`. Public `"use server"` action:
  - `getMonthSlots(input: { serviceSlug: string; month: string })`.
  - zod-validates the input, active services only.
  - Returns `ActionResult<{ days: { date: string; status: DaySlots["status"]; slots: string[] /* ISO */ }[] }>`.
- Create: `src/components/booking/month-calendar.tsx` (client).
  - Props: `{ month: string; days; selectedDate?: string; onMonthChange(m); onSelectDate(d); minMonth?: string; maxMonth?: string; renderDay?(date) }`.
  - Mockup A styling: dots in sage for open, terracotta for few; struck-through and greyed when full or closed.
  - Real `<button>`s with `aria-label` like "Saturday, 24 October, 3 times available", and arrow-key navigation within the grid.
- Create: `src/components/booking/time-slots.tsx`. Pill buttons with times formatted in Manila (`formatTime`), `aria-pressed`.
- Modify: `src/server/queries/public.ts`, so `getPublicSettings` adds the booking-rule fields and `max_concurrent_bookings`.
- Test: `src/components/booking/month-calendar.test.tsx` is **skipped** (no DOM test setup in this repo). Covered by the Task 6 e2e instead.

- [ ] Implement. `npm run typecheck` and `npm run lint` pass.
- [ ] Checkpoint.

### Task 5: Integration modules (PayMongo, Turnstile, Resend, rate limit)

**Files:**

- Create: `src/lib/payments/paymongo.ts`:
  - `createCheckoutSession(input: { referenceCode: string; amountCents: number; description: string; successUrl: string; cancelUrl: string; email?: string; name?: string; phone?: string }): Promise<{ id: string; checkoutUrl: string }>`
    - `POST https://api.paymongo.com/v1/checkout_sessions`, Basic auth `base64(secret + ":")`.
    - `payment_method_types: ["gcash","card","paymaya","grab_pay","qrph"]`.
    - `reference_number` = reference code.
    - Reads `data.id` and `data.attributes.checkout_url`.
  - `verifyWebhookSignature(rawBody: string, header: string | null, secret: string, livemode: boolean, nowSec?: number): boolean`
    - Header format: `t=<ts>,te=<sig>,li=<sig>`.
    - Expected = HMAC-SHA256(secret, `${t}.${rawBody}`) as hex.
    - Compare with `li` when livemode, otherwise `te`, using `timingSafeEqual`.
    - Reject when `|now - t| > 300`.
  - `parsePaidEvent(body: unknown): { eventId: string; type: string; livemode: boolean; checkoutId: string; reference: string; paymentId: string; amountCents: number } | null`
    - Envelope: `data.id`, `data.attributes.type`, `data.attributes.livemode`.
    - Session: `data.attributes.data` (`id`, `attributes.reference_number`, `attributes.payments[0].id`, `attributes.payments[0].attributes.amount`).
    - Returns null for any other type. **Confirm against a real test-mode delivery when the owner's keys exist** and adjust the parser if it differs.
- Create: `src/lib/payments/paymongo.test.ts` covering the signature: valid te, wrong secret, livemode uses li, stale timestamp, malformed header. Also `parsePaidEvent` on a fixture.
- Create: `src/lib/turnstile.ts`: `verifyTurnstile(token: string | undefined, ip: string | null): Promise<boolean>`. POSTs `https://challenges.cloudflare.com/turnstile/v0/siteverify`; skips per Global Constraints.
- Create: `src/lib/rate-limit.ts`: `rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>`. Calls the `hit_rate_limit` RPC via the admin client; the key is a sha256 of IP + action name.
- Create: `src/lib/email/send.ts`: `sendEmail({ to, subject, html, text }): Promise<void>`. POSTs `https://api.resend.com/emails` with `EMAIL_FROM`. Never throws; it logs instead.
- Create: `src/lib/email/booking-emails.ts`:
  - Builders `bookingReceivedEmail(b)`, `bookingConfirmedEmail(b)`, `bookingClosedEmail(b, "declined"|"cancelled")` and `newBookingAlertEmail(b)`.
  - Each returns `{ subject, html, text }`. Inline-styled HTML in brand colours, with the lookup link `${SITE_URL}/booking?ref=<ref>`.
- Create: `src/lib/booking/booking-summary.ts`: `bookingSummaryText(b: BookingSummary): string`, the "copy as text" content. Lines: reference, package, date/time in Manila, location, total, paid, balance, studio contact.
  - `export type BookingSummary = { reference: string; serviceName: string; startAt: string; endAt: string; location: string | null; priceCents: number; paidCents: number; contactName: string; studioName: string; studioPhone: string | null; studioEmail: string | null }`.
- Test: `src/lib/booking/booking-summary.test.ts`. The text includes `BK-2026-ABC123`, `₱3,500` and `Balance: ₱2,450`, and the time in Manila.
- Modify: `.env.example`, to document that PayMongo/Turnstile/Resend are optional in dev and required in production.

- [ ] Write the failing tests (signature, parser, summary). Implement. `npx vitest run src/lib` passes.
- [ ] Checkpoint.

### Task 6: Public wizard `/book`, booking action, return pages, `/booking` lookup

**Files:**

- Create: `src/lib/validations/booking.ts`:
  - `clientDetailsSchema` (fullName 2–120, email, phone 7–32, preferredContact in [email, phone, sms, messenger], messenger ≤300 optional, consent literal true).
  - `shootDetailsSchema` (location ≤300, participants 1–500, specialRequests ≤2000).
  - `publicBookingSchema` = both + `serviceSlug` + `startAt` (ISO) + `turnstileToken` + `website` (honeypot, must be empty).
  - Test file `booking.test.ts`.
- Create: `src/server/actions/booking.ts`: `submitBooking(input): Promise<ActionResult<{ redirectUrl: string }>>`. Steps:
  1. zod.
  2. Honeypot.
  3. `rateLimit(ip, 5, 600)`.
  4. `verifyTurnstile`.
  5. The PayMongo key must be configured when the deposit is > 0.
  6. `create_booking` via the admin client. Map errors to messages: `slot_unavailable` → "That time was just taken — please pick another.", plus `too_soon`, `too_far`, `blackout_date`, `outside_business_hours`, `service_unavailable`, `invalid_start_time`.
  7. If deposit > 0, `createCheckoutSession` with success `/book/done?ref=` and cancel `/book/cancelled?ref=`; store the payment row (`pending`, provider_checkout_id). Return `checkoutUrl`.
  8. If no deposit: send `bookingReceivedEmail` + the studio alert, and return `/book/done?ref=`.
  - Also export `resumePayment(ref, email)` for the cancelled page. If the booking is still `pending_payment` with a valid hold, it creates a new session.
- Create: `src/app/(public)/book/page.tsx`. A static shell plus `<Suspense>` around `BookingWizard`, which reads `searchParams.service` inside Suspense (see CLAUDE.md "Dynamic public routes"). Data: `listActiveServices()`, `getPublicSettings()`.
- Create: `src/components/booking/booking-wizard.tsx` (client):
  - Steps: Details → Package → Date & time → Shoot details → Review → Pay. A progress indicator; Back keeps the entered values.
  - With `?service`, that package is preselected, and the Package step shows it chosen with "Change".
  - On `slot_unavailable` it returns to the Date & time step and refetches.
  - Turnstile widget on Review: script `https://challenges.cloudflare.com/turnstile/v0/api.js`, rendered only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set.
- Create:
  - `src/app/(public)/book/done/page.tsx`: "Thanks! We're confirming your payment". It shows the reference and the lookup link, and never marks anything paid.
  - `src/app/(public)/book/cancelled/page.tsx`: hold expiry info plus "Try paying again" (asks for the email → `resumePayment`).
- Create:
  - `src/app/(public)/booking/page.tsx` + `src/components/booking/booking-lookup.tsx`: a ref + email form. A server action `lookupBooking({ ref, email })` uses the admin client (matching ref **and** lowercased client email), is rate limited (10/10 min), and returns the summary or "We couldn't find that booking".
  - `src/components/booking/booking-card.tsx`: the screenshot card (logo, reference, package, date/time, location, paid/balance, status badge). Shared with admin.
- Modify: `src/proxy.ts` is not touched. These pages are public.
- Test: `e2e/booking.spec.ts`, as described in the step below.

- [ ] Write the e2e test: `/services/<first>` → "Book now" → `/book?service=<slug>` with the package preselected. Fill Details, see the month calendar with at least one enabled day (seeded hours), pick a day and a time, fill shoot details, see Review with the price and deposit from the DB. With no PayMongo key in test, submitting shows "Online payment isn't available yet". Expect FAIL.
- [ ] Implement. The `booking.test.ts` validations and the e2e pass on a production build (`next build && next start -p 3124`).
- [ ] Checkpoint.

### Task 7: PayMongo webhook

**Files:**

- Create: `src/app/api/webhooks/paymongo/route.ts`: `export async function POST(req: Request)`.
  1. Read the raw text.
  2. Verify the signature, returning 401 on failure.
  3. Parse; return 200 and ignore other events.
  4. Insert into `payment_webhook_events` (event_id PK); on conflict, return 200 (duplicate).
  5. `mark_booking_paid`.
  6. Send emails for `paid`/`paid_late`/`needs_review`: the client gets "booking received", the studio gets the alert, marked "needs review" if flagged.
  7. `updateTag(TAGS.bookings)`.
  8. Return 200.
- Create: `src/app/api/webhooks/paymongo/route.test.ts`. Test the handler with a mocked admin client and mocked `sendEmail`:
  - The bad signature gives 401.
  - A duplicate event id gives 200 with no second RPC call.
  - Paid calls the RPC once and sends 2 emails.
- Modify: `src/lib/cache-tags.ts` adds `bookings: "bookings"`.

- [ ] Write the failing tests. Implement. `npx vitest run src/app/api` passes.
- [ ] Checkpoint.

### Task 8: Admin calendar (month + day timeline)

**Files:**

- Create: `src/server/queries/bookings.ts`:
  - `listBookingsForMonth(month: string): Promise<CalendarBooking[]>` (admin cookie client, RLS).
  - `getBookingForAdmin(id: string): Promise<AdminBooking | null>`, which includes the client, service, payments and `paidCents`.
  - Types: `CalendarBooking = { id; reference_code; status; start_at; end_at; contact_name; service_name; needs_refund_review; source }`.
- Create: `src/app/(admin)/admin/(protected)/calendar/page.tsx`:
  - `requireAdmin()`. `searchParams` `month`, `day` and `cancelled=1` are read inside Suspense.
  - The month defaults to the current Manila month.
- Create: `src/components/admin/calendar/admin-month-grid.tsx`:
  - A 7-column grid with chips (`10a Cruz · Debut`), "+N more" beyond 3, closed/blackout days hatched, and today marked.
  - Links use `?month=&day=`.
  - Chips are links to `/admin/bookings/[id]`.
- Create: `src/components/admin/calendar/day-timeline.tsx`:
  - Opening hours (or 8:00–20:00 if closed), in rows by the slot interval.
  - Bookings as blocks positioned by time, with overlapping ones laid out in columns.
  - Free gaps (occupancy < capacity) link to `/admin/bookings/new?date=YYYY-MM-DD&time=HH:MM`.
  - A warning badge for `needs_refund_review`.
  - On phones it renders below the grid.
- Create: `src/lib/booking/timeline-layout.ts`: `layoutDay(bookings: {id; start: Date; end: Date}[]): { id: string; column: number; columns: number }[]`, plus a test with 3 overlapping bookings giving 3 columns and 2 separate ones giving 1 column each.
- Modify: `src/components/admin/admin-nav.ts` adds `{ href: "/admin/calendar", label: "Calendar", icon: CalendarDaysIcon }` after Dashboard.

- [ ] `layoutDay` test fails, then implement it and it passes.
- [ ] Implement the pages. Typecheck and lint pass. Screenshot at 1280 and 390px, with no overflow.
- [ ] Checkpoint.

### Task 9: Admin new booking

**Files:**

- Create: `src/lib/validations/admin-booking.ts`: `adminBookingSchema`.
  - Fields: serviceId, date `YYYY-MM-DD`, time `HH:MM`, price (pesoString), fullName, email **optional**, phone, preferredContact, messenger, location, participants, specialRequests, `deposit: "gcash"|"cash"|"none"`, depositAmount (pesoString, required unless none), gcashReference (optional), consent literal true, `allowOutsideHours` boolean.
  - It transforms the input to RPC params, with `startAt` built with `TZDate` in Manila.
  - Tests: the email is optional, `preferredContact: "email"` requires an email, the deposit amount is required for gcash/cash, and it's ≤ the price.
- Create: `src/server/actions/admin-bookings.ts`: `createAdminBooking(input)`.
  - `adminAction` → `admin_create_booking` via the **admin client** (the function is service-role only; authorization comes from `adminAction`).
  - Maps `outside_business_hours`/`blackout_date` to `fail("…", { allowOutsideHours: ["needs-confirm"] })`, so the form shows the warning + "Book anyway".
  - Then `audit`, `revalidate(TAGS.bookings)`, and a confirmation email if there's an email address.
  - Redirects the client to `/admin/bookings/[id]`.
- Create: `src/app/(admin)/admin/(protected)/bookings/new/page.tsx` + `src/components/admin/bookings/admin-booking-form.tsx`:
  - The package select prefills the price.
  - The `MonthCalendar` + `TimeSlots` use `loadMonthAvailability(..., { admin: true })` through an admin action `getAdminMonthSlots`, plus an "Any time" input that leads to the warning path.
  - The client fields are followed by the deposit radio group.
  - The `?date&time` prefill comes from timeline gaps.

- [ ] Validation tests fail, then implement and they pass.
- [ ] e2e (in `e2e/admin-bookings.spec.ts`, using the temp admin):
  1. Calendar → a free gap → the form prefilled with the date/time.
  2. Create with no email and Cash ₱500.
  3. Land on the detail page, which shows "Paid ₱500" and the balance.
  4. The booking chip appears on the calendar.
  5. Cleanup: cancel the booking (it stays as cancelled; e2e bookings use contact name `E2E Client …` and the cleanup script deletes them via SQL with `bookings`/`payments`/`clients` where `contact_name like 'E2E Client%'`).
- [ ] Checkpoint.

### Task 10: Admin booking detail

**Files:**

- Create: `src/app/(admin)/admin/(protected)/bookings/[id]/page.tsx`. `requireAdmin()`; params are read inside Suspense.
- Create: `src/components/admin/bookings/contact-actions.tsx`:
  - Call `tel:`, SMS `sms:`, Email `mailto:?subject=Your Light Chasers booking <ref>`.
  - Messenger: if `messenger` matches `^https?://(www\.)?(facebook\.com|m\.me|messenger\.com)/`, it opens the link. Otherwise it copies the name and opens `https://www.messenger.com/`.
  - The preferred method gets a highlighted ring. Buttons whose data is missing are hidden.
- Create: `src/components/admin/bookings/share-booking.tsx`: `<BookingCard/>` + a "Copy as text" button (`bookingSummaryText`, `navigator.clipboard`, toast) + "Resend email" (hidden when there's no email).
- Create: `src/components/admin/bookings/status-actions.tsx`:
  - Pending: Confirm and Decline.
  - Confirmed: Mark completed.
  - Any active status: Cancel (with a ConfirmDelete-style dialog).
- Create: `src/components/admin/bookings/record-payment-form.tsx`: provider gcash/cash, amount, reference.
- Modify: `src/server/actions/admin-bookings.ts` adds:
  - `setBookingStatus({ id, status })`: emails on confirm, decline and cancel.
  - `recordPayment({ bookingId, provider, amount, reference })`.
  - `saveAdminNotes({ id, notes })`.
  - `resendBookingEmail({ id })`.
  - All go through `adminAction` + `audit` + `revalidate(TAGS.bookings)`. Payments use the admin client after `assertAdmin` (payments have no admin insert policy).
- A `needs_refund_review` banner: "Payment arrived after this slot filled up — refund or rebook the client in PayMongo", with a "Mark reviewed" action that clears the flag.

- [ ] Extend the Task 9 e2e: Copy as text puts the reference in the clipboard (grant clipboard permissions), "Record payment" GCash ₱300 makes the balance drop, and Cancel moves the status to Cancelled.
- [ ] Checkpoint.

### Task 11: Settings, docs, full verification

**Files:**

- Modify: `bookingRulesSchema` + the booking rules form, adding "Shoots that can run at the same time" (1–10) → `max_concurrent_bookings`. The existing settings action passes it through.
- Modify: `CLAUDE.md` (Phase 5 progress, the capacity design replacing the exclusion constraint, the integration fallbacks), `docs/HANDOFF.md` and `docs/SETUP.md` (new env behaviour, the Versa Space note, the webhook URL to register).
- Modify: the scratchpad cleanup script, which also deletes `E2E Client%` bookings, payments and clients.

- [ ] Run `npm run check`; expect PASS.
- [ ] Run `npm run test:db`; expect PASS.
- [ ] Production build e2e: `npx playwright test` against `next start -p 3124` with a temp admin, then delete the temp admin and run cleanup. Expect all pass (PayMongo-dependent steps excluded).
- [ ] Screenshots: `/book` (desktop/mobile/dark), the admin calendar, booking detail. No overflow.
- [ ] Report to the owner, including the setup list.
