# Booking flow & calendars: design

_2026-10-15 · Phase 5 (plus the calendar part of Phase 6) · Light Chasers Studio_

## Why

Today a booking starts with the owner checking by hand whether a date, and a time on that date, is free. This feature turns that check into a calendar both sides can use:

- **Clients** see which dates and times are really free on the website and book themselves, paying a deposit online.
- **The studio** sees every booking and every free gap on one admin calendar, and can book a client in directly when the client arranged it over Messenger, by phone or in person.

Success: the owner stops checking availability by hand. Clients can't book a slot that's already taken. Staff can create, review, confirm and share a booking without leaving the admin.

## Goals

1. Public booking wizard at `/book` with a **month calendar + time list** date picker (mockup option A, chosen by the owner).
2. Online deposit through **PayMongo**. The slot is held while the client pays.
3. Admin **Calendar** page: **month overview + day timeline** (mockup option A, chosen by the owner).
4. Admin can **book a client in** from the calendar, recording the deposit as GCash transfer, cash or "pay at the shoot".
5. Admin **booking detail page** with:
   - Contact buttons (call, SMS, email, Messenger).
   - A screenshot-friendly booking card and a "copy as text" button for Messenger.
   - Status actions and payment recording.
6. Confirmation **emails** through Resend, for both client- and admin-made bookings.
7. **Several shoots can run at the same time.** The number is an admin setting.

## Non-goals (this phase)

- Week view and list view of the calendar. Month + day timeline only.
- Assigning photographers to bookings, or per-photographer calendars. Capacity is one studio-wide number.
- Rescheduling an existing booking. Cancel and re-book for now; proper reschedule comes in Phase 6.
- The dashboard stats, the searchable bookings table, the clients list and privacy anonymisation. These stay in Phase 6.
- Refunds through PayMongo. Refunds are handled outside the site; the admin can mark a booking cancelled.
- Viber. The owner explicitly removed it. The `viber` enum value stays in the DB but is never offered in any UI.

## Anti-goals (would make this a failure even if it "works")

- A client pays a deposit for a slot that turns out to be full. Capacity must be enforced in the database, under concurrency.
- A booking marked paid without PayMongo actually confirming it. Only the signature-verified webhook marks online payments paid.
- Client contact details visible to anyone without the reference code **and** email.
- A calendar that's unusable on a phone. Both calendars must work at 360px wide.

## Decided by the owner

- **Client date picker:** a month calendar where dots mark days with free time (a second colour for "few left"); closed or fully booked days are greyed out. Tap a day to see its start times as pill buttons.
- **Admin calendar:** a month grid with bookings colour-coded by status. Click a day to open a side panel with that day's hour-by-hour timeline of bookings and free gaps; on phones the panel sits below the month. A "+ New booking" button is always visible, and clicking a free gap opens New booking with that date and time filled in.
- **Admin-made bookings:** the client may have paid by **GCash transfer**, in **cash**, or will **pay at the shoot**. The admin records which.
- **Sharing:** the client gets a confirmation email. The admin can also share the booking through Messenger by screenshotting a booking card or copying the details as text.
- **Contact:** the admin needs one-tap ways to reach the client. **No Viber.**
- **Concurrency:** two or more shoots can run at the same time. Make it a setting so it can change later.
- **Email is optional on admin-made bookings.** Clients arranged over Messenger may not give one; they get no email, and the admin shares the booking card instead. Email stays **required** on the public wizard.
- **Admin can book outside opening hours (and on blocked dates) after a warning.** The form shows "This is outside your opening hours / on a blocked date" and needs an explicit "Book anyway" before saving. Capacity is never bypassed.
- **Admin can set a custom price** on bookings they create (discounts, custom packages). It's pre-filled with the package price.

## Decided by Claude (owner can override)

- **Wizard order follows the spec** (`docs/master-prompt.md`):
  1. Your details: name, email, phone, preferred contact, optional Messenger name/link, and the required privacy consent.
  2. Package.
  3. Date & time.
  4. Shoot details: location, number of people, special requests.
  5. Review.
  6. Pay.

  Coming from a service page (`/book?service=<slug>`) pre-selects the package, and the package step shows it already chosen.

- **Capacity setting:** `business_settings.max_concurrent_bookings`, default **2**, range 1–10. It's edited in Settings → Booking rules, labelled "Shoots that can run at the same time".
- **Admin-made bookings are `confirmed` immediately.** The admin made them, so there's no review step and no hold.
  - They always obey **capacity**. Opening hours and blackout dates only warn (see above).
  - They **ignore the minimum-notice and max-advance rules**, so the owner can book someone for tomorrow.
  - Deposit on admin bookings = the package's deposit rule applied to the custom price, capped at the price. It's informational; what was actually paid is recorded as payments.
- **"Few left" dot:** a day with 1–2 bookable start times left.
- **Client's own booking page:** `/booking` asks for the reference code and email, then shows the same booking card. The confirmation email links to `/booking?ref=BK-…`, so only the email needs typing. There's no magic link.
- **Messenger:** a new optional text field `messenger` on bookings, for a Facebook name or profile link. If it's a URL on `facebook.com`, `m.me` or `messenger.com`, the Messenger button opens it. Otherwise the button copies the name and opens `https://www.messenger.com/`.
- **Email button:** `mailto:` with the subject `Your Light Chasers booking <ref>`.
- **Emails sent:**
  - To the client:
    - **Booking received:** after the deposit is paid, or straight away when no deposit is due.
    - **Booking confirmed:** when the admin confirms, and on admin-made bookings.
    - **Booking declined or cancelled.**
  - To the studio email in Settings: **new booking needs review** (deposit paid).
  - A **Resend email** button on the booking page resends the latest client email. Bookings without an email skip all client emails and the button is hidden.
- **Status colours** (from the brand tokens):
  - Confirmed and completed: sage.
  - Pending (deposit paid, needs review): terracotta/blush.
  - Pending payment: dashed grey.
  - Cancelled, declined and expired: hidden from the calendar by default, with a "Show cancelled" toggle.

## Data model changes

New migration(s) in `supabase/migrations/`. Never edit the dashboard.

1. `business_settings.max_concurrent_bookings integer not null default 2 check (between 1 and 10)`.
2. **Replace the exclusion constraint** `bookings_no_overlap` with a capacity check. Inside `create_booking`, and inside the new admin RPC:
   - Take a transaction-scoped lock that serialises booking creation, e.g. `pg_advisory_xact_lock(<constant>)`.
   - Count the **maximum number of simultaneously blocking bookings** anywhere in `[start_at, blocked_until)`. That isn't the total overlapping: two bookings 9–10 and 11–12 never coincide, so a 9–12 booking still fits under capacity 2.
   - Raise `slot_unavailable` when that maximum + 1 > capacity.
   - Blocking statuses stay as today: `pending_payment` (unexpired hold), `pending`, `confirmed`, `completed`.
3. `bookings.messenger text check (char_length <= 300)`, nullable.
4. `bookings.source text not null default 'online' check (source in ('online','admin'))`.
5. `payments`:
   - Constrain `provider in ('paymongo','gcash','cash')`.
   - Add `reference text` (GCash ref no., ≤ 100 chars) and `recorded_by uuid references auth.users` for manual payments.
   - Manual payments are inserted with `status = 'paid'` and `paid_at = now()`.
   - **Paid so far** = sum of `paid` payments. **Balance** = `price_cents − paid so far`.
6. **New RPC `admin_create_booking(...)`:** service-role only, called from an `adminAction` after `assertAdmin()`.
   - Checks: service exists (inactive services allowed, since the admin may book a retired package), valid slot alignment and capacity. **No** notice/advance checks.
   - Opening hours and blackouts are checked only when `p_allow_outside_hours` is false; then it raises `outside_business_hours` / `blackout_date` like `create_booking`. The server action passes `true` only after the admin clicked "Book anyway".
   - `p_price_cents` (custom price, ≥ 0); deposit derived as described above.
   - Status `confirmed`, `source='admin'`, no hold.
   - Optional initial payment (`provider`, `amount_cents`, `reference`).
   - Client row: if an email is given, matched by email and **not** overwritten, the same rule as public bookings. With no email, a new client row is created.
7. **`clients.email` becomes nullable.** The check becomes `email is null or (...)`. The unique index on `lower(email)` already allows many NULLs. `create_booking` (public) still requires it.
   - Consent: the admin form has a required checkbox, "Client agreed to the privacy notice", which records consent version `admin-<version>`.
8. `get_busy_ranges` keeps its shape. The slot picker computes per-slot occupancy and compares it to capacity, so expose `max_concurrent_bookings` through the public settings query.
9. Regenerate `src/types/database.types.ts`. Add DB tests in `supabase/tests/`:
   - Capacity 1/2/3 behaviour, including the "non-coinciding overlaps fit" case.
   - Concurrent inserts can't exceed capacity.
   - The admin RPC skips the notice rule; hours/blackouts are enforced unless overridden; capacity is never bypassed; a booking with no email works.
   - Anon can't call the admin RPC.

## Public flow details

- **Slot computation** happens on the server or in the client from public data: weekly hours, blackouts, busy ranges, service duration, buffer, slot interval, notice/advance and capacity. Times are always in Asia/Manila (`@date-fns/tz`).
  - The calendar loads one month at a time; `get_busy_ranges` caps at 62 days.
  - The final check is always `create_booking`. If it says `slot_unavailable`, the wizard goes back to the time step with a friendly message and refreshed slots.
- **Submit (server action):**
  1. zod re-validation.
  2. Honeypot field.
  3. Cloudflare Turnstile verification.
  4. Rate limit per IP, e.g. 5 attempts per 10 min, stored in Postgres. No new infrastructure.
  5. `create_booking`.
  6. Create a PayMongo Checkout Session for `deposit_cents`.
  7. Redirect to checkout.

  If no deposit is due, skip PayMongo and go straight to confirmation.

- **Return from PayMongo:** the success page shows "Payment received, we're confirming". It re-reads the status and never trusts the redirect. The cancel page explains that the hold expires at `hold_expires_at` and offers "Try paying again" while the hold lasts.
- **Webhook** `src/app/api/webhooks/paymongo/route.ts`:
  - Verify the signature.
  - Make it idempotent through `payment_webhook_events`.
  - On paid: payment → `paid`, booking `pending_payment → pending`, clear the hold, send the emails.
  - If the hold already expired but the payment came through, keep the booking only if capacity still allows. Otherwise flag it for a manual refund in the admin; never silently drop money.
  - **Check PayMongo's current docs** for event names and fields before writing it.
- `BOOK_HREF` → `/book`.

## Admin details

- **Navigation:** new **Calendar** item (and **Bookings** later in Phase 6) in `admin-nav.ts`.
- **Calendar page** `/admin/calendar?month=2026-10&day=2026-10-24`. State lives in the URL so it can be linked and the back button works.
  - **Month grid:** booking chips per day ("10a Cruz · Debut"), "+N more" when a day overflows, and closed/blackout days hatched.
  - **Day panel:** a timeline across opening hours, bookings as blocks with overlapping ones side by side, and free gaps that open New booking. With capacity > 1, a gap counts as free while occupancy < capacity.
- **New booking** `/admin/bookings/new?date=&time=`:
  - Package, date and time (the same slot picker without the notice/advance rules, plus a "pick any time" option that shows the outside-hours warning), price (pre-filled, editable), then client details (email optional) including Messenger, then shoot details.
  - Deposit: **GCash** (amount + reference), **Cash** (amount) or **Pay at the shoot**.
  - The privacy consent checkbox.
- **Booking detail** `/admin/bookings/[id]`:
  - **Contact:** Call (`tel:`), SMS (`sms:`), Email (`mailto:`) and Messenger. The preferred method is highlighted.
  - **Booking card:** the branded summary to screenshot, with copy-as-text.
  - **Status actions:**
    - Confirm, Decline (from `pending`).
    - Mark completed (from `confirmed`).
    - Cancel (from any active status).
    - All of these go through the existing status trigger, are audited, and send their email.
  - **Payments:** list, paid so far, balance, and Record payment (GCash/cash).
  - **Admin notes.**
  - **Resend email.**
- Every page calls `requireAdmin()`, every action goes through `adminAction` + `audit`, and `revalidate` uses a new `TAGS.bookings`.

## Setup the owner must do (before payment and email can be tested)

- **PayMongo:** account plus **test** secret key; webhook secret once the webhook URL exists. A local test needs a tunnel or a deployed preview.
- **Cloudflare Turnstile:** site key + secret key, with `localhost` and the future domain added.
- **Resend:** API key, plus a verified sending domain. Until then, testing only reaches the owner's own address.
- **Copy:** deposit amount rules, and the cancellation/refund policy wording shown at review and in emails. **Never invented.**

## Left to the builder

Component structure, the exact rate-limit storage, how slot computation is split between server and client, email template layout (on-brand, plain-text fallback), and test layout. Unit tests are required for the slot calculator (capacity, buffer, timezone, DST-free Manila, day boundaries) and for the status/payment maths. E2E tests cover the wizard up to the PayMongo redirect, and admin create → detail → confirm.
