# Handoff: Light Chasers Studio booking site

_Last updated: 2026-10-30. Phases 0–5 and the extras (PRs #8–#21) are on `main`. Branch `complete-features` (waiting for its PR) adds Phase 6 (bookings table, clients, activity), privacy (policy page, delete a client's data), the workshop loose ends, Phase 7 hardening and the known small fixes. QR Ph payments work in PayMongo test mode; Turnstile is live._

This document says where the project stands: what's built, what's verified, what's left, and the decisions and limits a new person needs to know. For first-time setup on a new machine, see [`SETUP.md`](SETUP.md). For the full product spec and roadmap, see [`master-prompt.md`](master-prompt.md). For coding rules and architecture notes, see [`../CLAUDE.md`](../CLAUDE.md).

## The project in one paragraph

A booking website for **Light Chasers Studio**, a photography studio in Zamboanga City (weddings & prenups, portraits & family, events, product shoots). Visitors browse services and the portfolio without logging in, pick a free date and time on a month calendar, and pay a deposit through PayMongo (GCash and others). Staff can also book clients in themselves from an admin calendar. Staff manage everything from an admin area at `/admin`, which is the only part that needs a login. Built with Next.js 16, Tailwind v4, shadcn/ui and Supabase (Postgres, Auth, Storage).

## Where we left off

- **Phases 0–5 are built, verified and merged into `main`** (Phase 5 = PR #7), plus booking extras, booking management, package lengths, Gmail sending, package highlights, a security upgrade, the workshop and its rework (PRs #8–#21, latest on 2026-10-28).
- **Waiting to merge: branch `complete-features`** (2026-10-30), see [2026-10-30](#2026-10-30-finishing-branch-complete-features). Its two migrations are already on the dev database; both only add things, so `main` keeps working.
- **Emails work** from the studio Gmail. **Bot protection (Turnstile) is on** (both keys set, checked 2026-10-30). **Payments:** QR Ph works end to end in PayMongo **test mode** on the live site (webhook verified, booking marked paid). Going live needs the live key and a live webhook; Maya, GCash and cards wait on PayMongo's approval (see [Next steps](#next-steps)).
- **Hosting:** Vercel deploys from `main`, using the **dev** Supabase project for now. A separate production database is still Phase 8.
- **The dev database** has every migration applied, including the branch's (latest `20261030000200_purge_rate_limits.sql`, 2026-10-30).

## Roadmap status

| Phase | What                                                                        | Status                       | PR                         |
| ----- | --------------------------------------------------------------------------- | ---------------------------- | -------------------------- |
| 0     | Foundation: project setup, design system, env, linting                      | ✅ Done                      | #1                         |
| 1     | Database: schema, RLS, booking functions, storage, seed, types              | ✅ Done, pushed to dev DB    | #2                         |
| 2     | Admin auth: login, route protection, admin shell, create-admin script       | ✅ Done, real login verified | #3                         |
| 3     | Admin content: services, availability, portfolio, settings, account         | ✅ Done                      | #4                         |
| 4     | Public site: home, services, portfolio, about, contact, 404, hero animation | ✅ Done                      | #5                         |
| 5     | Booking flow + admin calendar, staff bookings, payments, emails             | ✅ Merged, needs owner keys  | #7                         |
| —     | Extras: add-ons, VAT, reviews, FAQ, sales report, dashboard, trial mode     | ✅ Done                      | #8–#12                     |
| —     | Booking management: edit, history, owner delete, monthly CSV                | ✅ Done                      | #13                        |
| —     | Package lengths + add-on rules, real sales report                           | ✅ Done                      | #14                        |
| —     | Emails from the studio Gmail                                                | ✅ Done, working on dev      | #15                        |
| —     | Package highlights (photo row, own reel), before/after slider removed       | ✅ Done                      | #16                        |
| —     | Security: Next.js 16.4.3, dependency patches (`npm audit`: 0)               | ✅ Done                      | #17                        |
| —     | Workshop booking (base for the other developer)                             | ✅ Done                      | #18                        |
| —     | Workshop rework, home workshop banner, framed portfolio                     | ✅ Done                      | #19, #21                   |
| 6     | Admin: bookings table, clients, activity log, privacy anonymise             | ✅ Built, waiting to merge   | branch `complete-features` |
| 7     | Hardening: CSP/HSTS, error pages, sitemap/robots, Lighthouse fixes          | ✅ Built, waiting to merge   | branch `complete-features` |
| 8     | Deploy: Vercel + production Supabase                                        | ⏳ Vercel (dev DB) running   |                            |

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
- **Double bookings are impossible at the database level.** Every booking path calls `assert_capacity`, which locks and counts the bookings that overlap the time range (including the buffer time). (The original exclusion constraint was replaced by this in Phase 5.)
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
- **Several shoots at once.** Settings → Booking rules → "Shoots that can run at the same time" (now 1, see 2026-10-17 below). The database enforces it, even when two people book the last spot at the same moment.
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

- **Merged into `main`:** everything from `front-end-extras` / `payment-testing`: add-ons, 12% VAT (the studio is VAT-registered; set `vat_percent` to 0 in Settings to turn it off), stories, package compare (the before/after slider was removed on 2026-10-19), prep guide, draft save, share, unsaved-changes warning, and trial mode (`PAYMENTS_MOCK=true`, local testing only).
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
- **Monthly CSV for accounting:** Sales report → Download CSV (`/admin/reports/export?month=YYYY-MM`). One row per booking in that month with package, add-ons, before-VAT, VAT, total, paid, balance and payment method.
- **Database:** migration `20261018000100_booking_management.sql` adds `admin_update_booking` and `delete_booking` (both service role only) and lets `admin_create_booking` take add-ons.

### 2026-10-19: package lengths, add-on rules, real sales report (PR #14)

- **Only packages with a set length have an end time** (owner decision). Today that's the Photobooth (4 hours). Other packages are booked by start time only: they hold one slot (slot interval + buffer) and show no end time. Set or clear a package's length in Admin → Services.
- **Add-ons can add time** (e.g. photobooth extensions) and **can be limited to certain packages** (none picked = all packages). The database enforces both.
- Bookings can have up to 10,000 people.
- **The Sales report shows real data:** paid/confirmed/completed bookings by shoot month at their total incl. VAT, and "how clients paid" by payment date.
- **Sample photos** for the dev site: `npm run data:sample-photos` adds them; `npm run data:sample-photos -- --remove` takes them out before go-live.

### 2026-10-19: emails from the studio Gmail (PR #15)

- The studio has no domain, so Resend can't reach clients. Emails now go out from lightchasers.studio@gmail.com through a Google app password (`GMAIL_USER`, `GMAIL_APP_PASSWORD`). Resend is only used if Gmail isn't set, for a future owned domain.
- Trial mode also sends real emails when Gmail is set, so pretend payments reach real inboxes.

### 2026-10-19: package highlights (PR #16)

- **Package pages** show "Moments we've captured": photos linked to that package first, topped up with the same kind of shoot (up to 6).
- **Home "tap to watch our highlights":** a package with 5+ linked photos gets its own reel next to its category (now Wedding Day Coverage).
- **Removed** the before/after slider section from the home page (owner found it unnecessary).

### 2026-10-25: security upgrade (PR #17)

- Next.js 16.4.0 → **16.4.3** (fixes critical advisories: remote code execution via `use cache` and the image optimizer, DoS via Server Actions), `eslint-config-next` 16.4.3, zod 4.6.7, and `npm audit fix` for undici, body-parser, fast-uri and ip-address. `npm audit`: 0 vulnerabilities.

### 2026-10-27: workshop booking (PR #18, base for the other developer)

_Partly replaced on 2026-10-28 (next section): clients no longer pick a date, and the price is per person by category. The pay-half/full choice and the refund rule stay._

- **For clients:** a "Workshop" button floats on the left of every public page (Messenger stays on the right). It opens `/workshop`: the same steps as a booking, but step 2 is **Payment**: pay half or pay in full, and tick the refund rule. They then pick a free date and time on the same calendar and pay through PayMongo (or the pretend checkout in trial mode). The workshop never appears in the normal package lists.
- **Refund rule (owner's):** paid half = no refund if they can't attend; paid in full = half of the price back. Refunds are sent by hand; the admin booking page says what's due.
- **For staff:** workshop sign-ups are ordinary bookings: calendar, review/confirm, payments, edit, CSV and sales report all work. Edit the workshop (name, price, description, cover photo, on/off) in Admin → Services; it's the "Workshop" category. Turning it off hides the button.
- **Placeholder:** "Photography Workshop", ₱1,000 + VAT, with placeholder text. Replace it before go-live.
- **Left for the other developer:** workshop options, refund wording in emails, a workshop section in the reports.

### 2026-10-28: workshop rework (PRs #19, #21)

All owner decisions from 2026-10-28. Migrations `20261028000100` to `000600`, all applied to dev.

- **Home page:** a "Now open · learn with us" **workshop banner** right under the hero (above the highlight reels): name, summary, date, time, location, "from ₱… per person", and a "Sign up for the workshop" button to `/workshop`. Hidden when no workshop is active; says "Coming soon" until a date is set. Component: `src/components/public/workshop-promo.tsx`.
- **Portfolio page:** the uneven masonry columns are now an **even gallery wall**: every photo in a white mat frame, wide photos one cell, upright ones two rows, `grid-flow-dense` fills the gaps. Hover shows a lift, viewfinder corners and the package / category label; the full uncropped photo still opens in the viewer (`portfolio-gallery.tsx`).
- **The admin sets the workshop's date, time, location and seats** (Admin → Services → the workshop → **Workshop schedule**). Clients don't pick a time: every sign-up gets the workshop's time and place (the database ignores what the browser sends). Empty date = "date coming soon", sign-up closed. Changing the date or place **moves everyone already signed up** (a trigger) but **doesn't email them**.
- **While the workshop runs, the studio is busy:** that time is unavailable for shoots on the public calendar and refused by `create_booking`. Staff can still book a shoot then. Workshop sign-ups don't count towards shoot capacity.
- **Up to 3 people per sign-up**, priced **per person**. The wizard is: Your details → **Who's coming** (1 / 2 / 3; more than the seats left is greyed out) → **Certificates** → Payment (half or full of the total) → Review & pay.
- **Certificates step:** a card per person with their **full name for the certificate**, **mobile number and address** (required; person 1 starts with the booker's number; the admin booking page lists them, number tap-to-call) and a **price category**:
  - **Regular** = the workshop's main price (₱5,000 now).
  - **Early bird** (₱4,000): closes on its own after its last day (31 January 2027) or when its places run out (25), counting the others on the same sign-up.
  - **Student** (₱4,000): the person must **upload a photo of a valid student ID**. It's resized in the browser (strips EXIF/GPS) and uploaded to the private `student-ids` bucket through a one-time link from the server (`src/server/actions/student-id.ts`); `create_booking` checks the file exists.
- **Each category can be switched off on its own** (Admin → Services → **Price categories**: a switch and price per category). Off = not offered anywhere and refused by the database; prices are kept while off; all three off = "Sign-ups are paused". People already signed up keep their category.
- **Admin booking page** for a workshop: every person with category and price; for students the ID photo (a 30-minute signed link) with **Accept / Reject**, recorded in the booking's History. **A rejected ID is handled by hand** (owner decision): contact the client and change the price in Edit booking.
- **Data:** `booking_attendees` table (admins only), `services.workshop_*` columns, `workshop_seats_taken()` / `workshop_early_birds_taken()` (no personal data, callable by anon). New `create_booking` codes: `workshop_not_scheduled`, `workshop_closed`, `workshop_full`, `invalid_participants`, `invalid_attendees`, `category_unavailable`, `student_id_required`, `early_bird_closed`, `early_bird_full`. Code map: CLAUDE.md → Workshop.
- **Home banner photo** is a slideshow: up to 6 photos (the workshop's cover first, then upright gallery photos) cross-fade with a slow zoom; pauses on hover, still with reduced motion (`polaroid-slideshow.tsx`).
- **PayMongo checkout methods** were narrowed to GCash, Maya and card here; replaced on 2026-10-30 by the `PAYMONGO_PAYMENT_METHODS` setting (see below).
- **Fixes along the way:** a workshop with no date was blocking every shoot (a null range bound is unbounded); the home page failed to build once a date was set (TZDate reads the clock during prerender, so dates use `Intl`); the service form failed silently when a switch was invalid (it now says why).

### 2026-10-30: payments on QR Ph, Turnstile live (on `main`)

- **Turnstile** keys are set locally and in Vercel; the widget shows on the Review step and the server check passes (tested with a pretend booking). After a refused submit the widget resets, since Cloudflare tokens work only once.
- **Payment methods are a setting:** `PAYMONGO_PAYMENT_METHODS` (comma list, default `qrph`, validated against PayMongo's method codes). PayMongo refuses the **whole** checkout if a listed method isn't active on the account, and today only **QR Ph** is (GCash, Maya and bank-app users pay by scanning it). **Maya** awaits PayMongo's activation; **GCash and cards** need the account upgraded from Individual to a registered business (DTI + BIR 2303). When one is approved: add it to the setting in Vercel (e.g. `qrph,paymaya`) and redeploy, then update the hand-written FAQ and home page text ("scan a QR Ph code with GCash, Maya or your bank app"). The Review step names the methods from the setting.
- **Test mode verified on the live site:** a QR Ph test payment marked booking `BK-2026-383DA0` paid through the webhook; the real PayMongo payload matched `parsePaidEvent`.
- **Webhook gotchas we hit:** the URL must be exactly `https://light-chasers-studio.vercel.app/api/webhooks/paymongo` (a double slash redirects, and PayMongo doesn't follow redirects); and the dashboard made a **live-mode** endpoint, which test payments never call. The test-mode webhook (`hook_bRXrNNRuXEaxdbFwfouTJRam`) was created through the API with the test key; its secret is the one in Vercel's `PAYMONGO_WEBHOOK_SECRET` now. The live endpoint is kept for go-live, with its own secret.

### 2026-10-30: finishing (branch `complete-features`)

- **Calendar freshness:** the booking calendar reloads free times when the visitor comes back to the tab. (Times that "disappear" a day or two ahead are usually the 48-hour minimum notice, not a bug.)
- **Bookings** (`/admin/bookings`): every booking with search (name, email, phone, reference), status, package and shoot-date filters, 25 per page, filters in the URL.
- **Clients** (`/admin/clients`, `/admin/clients/[id]`): bookings count, money received, contact details, consent date and version, booking history.
- **Activity** (`/admin/activity`): the audit log, who did what and when, filtered by kind, linking to the item.
- **Privacy (RA 10173):**
  - `/privacy` policy page, written from what the site actually collects. **It's a draft for the owner to review** (e.g. the retention wording). Linked from the booking consent and the footer; `CONSENT_VERSION` is `2026-10-30`.
  - **Delete personal data** (owner only, on the client page, type the name): `anonymise_client()` wipes the client's name, email, phone, booking notes, attendee details and PayMongo billing data, and keeps references, amounts and dates. Refused while the client has an upcoming booking.
  - **Delete photos from past workshops** (the workshop's page in Admin → Services): removes student ID photos once a workshop has ended. The policy says they're deleted after the workshop, so use it after each one.
- **Workshop:** emails and "copy as text" list each person (name, category, price) and the refund rule; changing the workshop's date, time or place emails everyone signed up (switch in the schedule card, on by default); a Workshop card in the sales report (people per price category); the home banner and floating button hide themselves once the workshop has ended.
- **Hardening:** a Content-Security-Policy (self, Supabase, Cloudflare Turnstile; no nonces so pages stay static) and HSTS, checked on a production build with no blocked requests; `/sitemap.xml` and `/robots.txt`; branded error pages; Lighthouse fixes (star-rating label, portfolio's first row not lazy-loaded). Lighthouse on this machine: accessibility 96–100, best practices 96–100, SEO 100, performance 62–73 (throttled low-memory laptop; the home hero's entrance animation delays its paint).
- **Small fixes:** the staff time picker no longer offers past times; payments can't be recorded on cancelled/declined/expired bookings; hour-long timeline blocks fit; calendar month arrows show a spinner while loading; old rate-limit rows are purged daily (pg_cron); `processed_at` is set on PayMongo events.
- **Migrations:** `20261030000100_privacy_anonymise.sql`, `20261030000200_purge_rate_limits.sql` (both applied to dev).

## Managing data

- **Two databases.** The dev project (`mkpjxrhjynbjuiovloiy`) is for testing and keeps all test bookings. The production project starts **empty** at go-live; never test there.
- **Clean test data on dev:** `npm run data:clean-tests` removes everything the e2e tests create (`E2E Client…` bookings and their payments/clients, `E2E Package…`, `E2E photo…`, `E2E test…` days off) and resets rate-limit counters. `npm run data:clean-tests -- --all-bookings` also wipes **every** booking, payment and client on dev (only with the owner's OK). The script refuses to run against any project other than dev.
- **Go-live copy:** `scripts/copy-catalog.mjs` copies packages, add-ons, opening hours, upcoming days off, portfolio, reviews, settings and their image files from dev to the new production project. It never copies bookings, payments or clients, and refuses a target that already has bookings. Run `npm run db:push` against production first, then `--dry-run`, then for real. **Not yet tested end to end** (needs the second project).
- **Real bookings:** cancel, don't delete. Every change is in the booking's History.
- **Backups:** turn on Supabase daily backups (and point-in-time recovery if the budget allows) on the production project before launch.
- **Accounting:** download the month's CSV from the Sales report.
- **Privacy requests (RA 10173):** Admin → Clients → the client → **Delete personal data** (owner only). Money records stay.
- **Student ID photos** (`student-ids` bucket, private): delete them after each workshop with **Delete photos from past workshops** (the workshop's page in Admin → Services); deleting a client's data removes theirs too. Uploads never used for a booking stay in the bucket (one test image, "TEST STUDENT ID", from 2026-10-28).

## How it's verified

| Check                 | Command                                                                           | Last result                                                |
| --------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Full project check    | `npm run check` (typecheck, lint, SQL parse, unit tests, build)                   | ✅ passing, 162 unit tests (branch, 2026-10-30)            |
| Database rules        | `npm run test:db` (needs `DATABASE_URL_TEST`)                                     | ✅ 51 passing against the dev project (branch, 2026-10-30) |
| Public site (browser) | `npm run test:e2e -- e2e/public-site.spec.ts`                                     | ✅ passing on desktop and phone (Pixel 7), touch included  |
| Admin flows (browser) | `e2e/admin-content.spec.ts` (needs an admin login, see below)                     | ✅ passing, includes public-page refresh after edits       |
| Booking (browser)     | `e2e/booking.spec.ts`, `e2e/admin-bookings.spec.ts`                               | ✅ wizard up to payment; staff booking, share, pay, cancel |
| Booking edit/delete   | `e2e/admin-booking-edit.spec.ts` (admin + `E2E_OWNER_EMAIL`/`E2E_OWNER_PASSWORD`) | ✅ edit time/package/add-ons/VAT; owner delete             |
| Workshop (browser)    | `e2e/workshop.spec.ts` (trial mode + admin login + a future workshop date)        | Updated; not run (needs the admin login)                   |

The admin e2e tests need `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`. Use a **temporary** admin account, delete it afterwards, and never use the owner account. The tests clean up what they create: services named `E2E Package…`, photos with alt text `E2E photo…` and blackouts with reason `E2E test…`. Booking tests leave cancelled bookings named `E2E Client…`; run `npm run data:clean-tests` after a run.

On this machine a full parallel e2e run is sometimes flaky under load (an admin sign-in or the hero swipe test timing out); those tests pass when rerun on their own. Run e2e against a production build (`npm run build`, `npx next start -p 3100`, `PLAYWRIGHT_BASE_URL=http://localhost:3100`): on 2026-10-30 `public-site` + `smoke` passed (18, 2 skipped by design), the hero swipe test included. The new admin pages weren't run in e2e (they need the admin login).

The workshop sign-up was checked by hand on 2026-10-28 (3 people: Regular, Early bird, Student with an ID upload, up to Review & pay, no booking made). The admin side (Price categories card, saving, the ID Accept / Reject) wasn't seen yet: it needs the owner's login.

## Environments and accounts

- **Supabase dev project:** ref `mkpjxrhjynbjuiovloiy`, hosted (no local Docker). All migrations and the seed are applied.
- **Owner admin account:** exists on the dev project. Credentials are held by the studio owner and are never written in the repo.
- **GitHub:** `lightchasersstudio-web/LightChasersStudio`. Work normally goes on one branch and one PR per phase, merged into `main`. Every push to `main` redeploys the live site once Vercel is connected.
- **Vercel:** deploys from `main`, with the dev Supabase project. Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BUSINESS_TIMEZONE`, `NEXT_PUBLIC_SITE_URL` (the live address; used for emails, PayMongo return pages and link previews), plus `GMAIL_USER` and `GMAIL_APP_PASSWORD` for emails. The live site and local development share **one database**.
- **Reaching the dev database from this machine:** the direct host is IPv6-only, so `db:push`, type generation and `test:db` go through the IPv4 session pooler (`aws-0-ap-northeast-1.pooler.supabase.com`, user `postgres.mkpjxrhjynbjuiovloiy`).
- **Set up:** Turnstile, PayMongo **test** key + test webhook, Gmail. **Not yet:** production Supabase, PayMongo live key + live webhook secret.

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
- **The dev site uses sample photos** (`npm run data:sample-photos`). Remove them with `-- --remove` and upload the studio's own photos (star a few as "featured") before go-live.
- **Seed content is placeholder.** Real prices, packages, hours and the "about" text must come from the owner. The workshop's summary still says "Placeholder: describe the workshop…" (it shows on the home banner).
- **Dependencies:** `npm audit` (2026-10-30): 3 low-severity issues, all inside the `shadcn` command-line tool (not shipped to the site); the suggested fix downgrades shadcn, so they're left.
- **The hero swipe** is tested in Chrome (desktop and Android emulation) but not yet on a real iPhone in Safari.
- **The GitHub CLI (`gh`) isn't installed** on the main dev machine, so PRs are opened from the GitHub website.
- **Workshop loose ends:** the admin calendar shows each sign-up as its own block at the workshop time; unused student-ID uploads (someone uploads, then doesn't book) stay in the bucket; editing a workshop booking in the admin doesn't change its people or categories; after the workshop the banner can flash briefly on load until it's switched off.
- **CSP and the Vercel toolbar:** the Vercel toolbar on preview deployments is blocked by the CSP (add `https://vercel.live` if it's wanted).

## Next steps

**Go live (owner):**

1. In Admin → Services check the workshop: **date** (it's 29 October 2026, but early bird runs to 31 January 2027), summary, location, seats and the price categories.
2. Check the Vercel env vars above (including the Gmail pair), then in Supabase → Authentication → URL Configuration set the **Site URL** to the Vercel address and add both `https://<vercel-address>/**` and `http://localhost:3000/**` to **Redirect URLs**.
3. Replace the placeholder packages and prices in the admin, add the Versa Space rental package(s), and add a studio phone number in Settings if clients should call.
4. Before launch: remove the sample photos (`npm run data:sample-photos -- --remove`) and set up the production Supabase project (Phase 8, see [Managing data](#managing-data)).

**Payments, to go live (owner):**

1. **Live mode:** in PayMongo switch to live, copy the `sk_live_…` key into Vercel's `PAYMONGO_SECRET_KEY`, and put the **live** endpoint's signing secret (`whsk_…`, for `https://light-chasers-studio.vercel.app/api/webhooks/paymongo`, event `checkout_session.payment.paid`) into `PAYMONGO_WEBHOOK_SECRET`. Redeploy, make one small real QR Ph payment, check it in Admin, refund it in PayMongo.
2. **More methods:** when PayMongo approves Maya (requested) or GCash/cards (after the business upgrade), add them to `PAYMONGO_PAYMENT_METHODS` (e.g. `qrph,paymaya,gcash,card`), redeploy, and update the FAQ and home page payment text.
3. **Owner wording:** deposit rules and the cancellation/refund policy for the review step and emails (the workshop's rule is already in). **Review the Privacy Policy draft** (`/privacy`).

**Merge `complete-features`:** open its PR on GitHub, check the Vercel preview (book with QR Ph in test mode, open Bookings / Clients / Activity, try `/sitemap.xml`), then merge.

**Phase 8 (go-live):** production Supabase project (`npm run db:push` to it, then `scripts/copy-catalog.mjs`), point Vercel at it, real content, sample photos removed, Supabase backups on.
