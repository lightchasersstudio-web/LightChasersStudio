# Setup guide: running Light Chasers Studio on your computer

This guide takes you from a fresh computer to the site running at `http://localhost:3000`, with access to the admin area. It takes about 20–30 minutes. Commands are given for **Windows (PowerShell)** and **macOS/Linux** where they differ.

For what's built so far and where the project stands, read [`HANDOFF.md`](HANDOFF.md).

---

## 1. Get access

Ask the project owner for:

1. **GitHub access** to `lightchasersstudio-web/LightChasersStudio`. Accept the email invite.
2. **The dev environment values** for your `.env.local` file (step 5): the Supabase URL, anon key and service-role key. They must come through a private channel, such as a password manager or a direct message you delete afterwards. **Never** by email thread, group chat or a GitHub issue.
3. **An admin account** for the admin area (step 8). The owner creates it for your email.
4. _(Optional)_ **An invite to the Supabase project**, if you'll change the database schema or run the database tests.

## 2. Install the tools

| Tool                    | Version                              | Get it                                                         | Check it works  |
| ----------------------- | ------------------------------------ | -------------------------------------------------------------- | --------------- |
| **Git**                 | any recent                           | https://git-scm.com/downloads (Windows: includes Git Bash)     | `git --version` |
| **Node.js** (with npm)  | **22 or newer** (24 LTS recommended) | https://nodejs.org (choose the LTS download)                   | `node -v`       |
| **A code editor**       |                                      | [VS Code](https://code.visualstudio.com) recommended           |                 |
| GitHub CLI _(optional)_ |                                      | Windows: `winget install GitHub.cli`, macOS: `brew install gh` | `gh --version`  |

You **don't** need to install Supabase or Docker. The project uses a hosted Supabase database, and the Supabase CLI runs through `npx` when needed.

After installing, **close and reopen your terminal** so the new commands are found.

Recommended VS Code extensions: ESLint, Prettier, Tailwind CSS IntelliSense.

## 3. Download the code

```bash
git clone https://github.com/lightchasersstudio-web/LightChasersStudio.git
cd LightChasersStudio
```

If Git asks you to sign in, use your GitHub account. On Windows, a browser window opens.

## 4. Install the project's packages

```bash
npm install
```

This takes a minute or two. Warnings like `npm audit` notices are expected; errors are not.

## 5. Create your `.env.local` file

This file holds the keys that connect the site to the database. It's **git-ignored**, so it never gets committed. Keep it that way.

```powershell
# Windows (PowerShell)
Copy-Item .env.example .env.local
```

```bash
# macOS / Linux / Git Bash
cp .env.example .env.local
```

Open `.env.local` in your editor and fill in the values the owner gave you:

| Variable                                                 | What it is                                         | Needed now?                                 |
| -------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                   | Leave as `http://localhost:3000`                   | ✅ Yes                                      |
| `BUSINESS_TIMEZONE`                                      | Leave as `Asia/Manila`                             | ✅ Yes                                      |
| `NEXT_PUBLIC_SUPABASE_URL`                               | Supabase project URL                               | ✅ Yes                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                          | Supabase public (anon) key                         | ✅ Yes                                      |
| `SUPABASE_SERVICE_ROLE_KEY`                              | Supabase secret key: **server only, never share**  | ✅ Yes                                      |
| `DATABASE_URL_TEST`                                      | Database connection string for DB tests            | Only for `npm run test:db`                  |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD`                       | Email sending from the studio Gmail (app password) | Optional in dev; needed for emails          |
| `RESEND_API_KEY`, `EMAIL_FROM`                           | Email via Resend (only with an owned domain)       | Optional; Gmail is used first when set      |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Bot protection                                     | Optional in dev; **required in production** |
| `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`         | Payments                                           | Optional in dev; needed to take deposits    |

Without these keys the site still runs: emails are skipped (you'll see "[email] not configured" in the terminal), the security check is skipped on your computer, and online booking stops at "Online payment isn't available yet." Staff bookings in the admin work fully.

**Testing payments locally** needs PayMongo **test** keys and a public URL for the webhook (PayMongo can't reach `localhost`), e.g. a tunnel or a Vercel preview. Register `<that URL>/api/webhooks/paymongo` for the `checkout_session.payment.paid` event and put the webhook's secret in `PAYMONGO_WEBHOOK_SECRET`.

> ⚠️ Never put a secret in a variable that starts with `NEXT_PUBLIC_`. Those are sent to the browser.

## 6. Start the site

```bash
npm run dev
```

Open **http://localhost:3000**. You should see the home page with the polaroid photo stack. Try:

- `/services`, `/portfolio`, `/about` and `/contact`
- Tapping or swiping the hero photos
- The dark-mode toggle (sun icon) and a narrow browser window for the mobile menu

Stop the server with **Ctrl + C**. If styles ever look stale or broken, stop it and run `npm run dev` again.

## 7. If something goes wrong

| Problem                                                                | Fix                                                                                                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `'npm' is not recognized` / `command not found: npm`                   | Node isn't installed or the terminal is old. Reinstall Node and reopen the terminal.                                  |
| Error mentioning `NEXT_PUBLIC_SUPABASE_URL` or a zod "invalid" message | `.env.local` is missing a value or has a typo. Compare with `.env.example`. No quotes or spaces needed around values. |
| `Port 3000 is in use`                                                  | Another dev server is running. Close it, or run `npm run dev -- -p 3001` and open that port.                          |
| Pages load but show no services                                        | The keys point to the wrong Supabase project. Check with the owner.                                                   |
| Admin login says "Invalid login credentials"                           | Wrong email or password, or your account hasn't been created yet (step 8).                                            |
| Admin login says you don't have access                                 | Your user exists but isn't an admin. Ask the owner to run the step 8 command for your email.                          |

## 8. Sign in to the admin area

1. **The owner** (or anyone with the service-role key) runs this on their machine, using your email:

   ```bash
   npm run admin:create -- colleague@example.com "Your Name" admin
   ```

   It prints a **temporary password once**. The owner sends it to you privately.

2. Go to **http://localhost:3000/admin/login** and sign in.
3. Open **Account** in the admin menu and **change your password** right away.

What you can manage from the admin: Services, Availability (hours and blocked dates), Portfolio (photos), Settings (studio profile, logo, booking rules) and Account.

> The dev database is **shared**. Changes you make in the admin (prices, photos, hours) are seen by everyone using it. Test with obviously fake names, such as "TEST package", and delete them afterwards.

## 9. Before you push code

Run the full check. It must pass before you open a pull request:

```bash
npm run check
```

It runs the type check, lint, SQL parsing, unit tests and a production build.

### Browser tests (optional but recommended)

```bash
npx playwright install chromium     # first time only
npm run test:e2e
```

The admin tests are skipped unless `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` are set. Use a **temporary test admin**, never a real account:

```powershell
# Windows (PowerShell)
$env:E2E_ADMIN_EMAIL="test-admin@example.com"; $env:E2E_ADMIN_PASSWORD="..."; npm run test:e2e
```

```bash
# macOS / Linux / Git Bash
E2E_ADMIN_EMAIL=test-admin@example.com E2E_ADMIN_PASSWORD=... npm run test:e2e
```

### Workflow

- Create a branch for your work: `git checkout -b my-change`. Never commit straight to `main`.
- Commit, push, and open a pull request on GitHub (or with `gh pr create`).
- Read `CLAUDE.md` for coding conventions and `docs/master-prompt.md` for the product spec.

## 10. Database work (only if you change the schema)

You need the Supabase project invite from step 1 and the database password from the owner.

```bash
npx supabase login                                     # opens a browser
npx supabase link --project-ref mkpjxrhjynbjuiovloiy   # asks for the database password
```

On Windows, run these in your own PowerShell window, not inside an editor's AI or task runner, because they need interactive input.

- Schema changes go in a **new SQL file** in `supabase/migrations/`. Never edit the database by hand in the Supabase dashboard.
- `npm run db:lint` checks your SQL without touching the database.
- `npm run db:push` applies new migrations to the dev database. **This affects everyone**, so coordinate first.
- `npm run db:types` regenerates `src/types/database.types.ts` after a schema change. Commit the result.
- `npm run test:db` runs the database rule tests. Needs `DATABASE_URL_TEST` (Supabase → Project Settings → Database → connection string, role `postgres`). Every test is rolled back, so it doesn't change data.

### Setting up your own separate Supabase project (optional)

If you want a private database instead of the shared one:

1. Create a free project at https://supabase.com. Pick the Singapore region, which is closest to the Philippines.
2. Go to **Database → Extensions** and enable **pg_cron**.
3. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up".
4. Link the CLI to your project (as above, with your own project ref), then run `npm run db:push:seed` to create the tables and placeholder data.
5. Put your project's URL and keys (from **Project Settings → API**) in `.env.local`.
6. Create your own admin with `npm run admin:create -- you@example.com "Your Name" owner`.

## Security rules (please read)

- `.env.local`, passwords and keys **never** go into Git, screenshots, chats or issues.
- The **service-role key bypasses all database security.** Only server code and the admin script use it.
- Don't create admin accounts for anyone without the owner's OK. There is intentionally no public sign-up.
- Client data falls under the Philippines Data Privacy Act. Don't copy real client data out of the database.
