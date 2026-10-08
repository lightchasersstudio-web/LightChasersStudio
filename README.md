# Light Chasers Studio

Booking website for Light Chasers Studio, a photography studio in Zamboanga City. Clients browse services and the portfolio, then book a session and pay a deposit online. Staff manage everything from an admin dashboard.

**Stack:** Next.js 16 (App Router, TypeScript), Tailwind CSS v4, shadcn/ui, Supabase (Postgres, Auth, Storage, RLS), PayMongo, Resend, Cloudflare Turnstile, deployed on Vercel.

## Getting started

Requirements: Node 22+ and npm.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

### Supabase

The project uses hosted Supabase projects: one for development, one for production.

```bash
npx supabase login
npx supabase link --project-ref <dev-project-ref>
npm run db:push      # apply migrations in supabase/migrations
npm run db:types     # regenerate src/types/database.types.ts
```

Put the project URL, anon key and service role key into `.env.local`. Never expose the service role key to the browser.

In the Supabase dashboard, go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". Admin accounts are created only with:

```bash
npm run admin:create -- owner@example.com "Full Name" owner
```

This prints a temporary password once.

## Scripts

| Script             | Purpose                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `npm run dev`      | Development server                                                         |
| `npm run check`    | Typecheck, lint, unit tests and production build                           |
| `npm test`         | Unit tests (Vitest)                                                        |
| `npm run test:e2e` | End-to-end tests (Playwright; run `npx playwright install chromium` first) |
| `npm run format`   | Format with Prettier                                                       |

## Project docs

- `docs/master-prompt.md`: full product spec, data model, security requirements and roadmap
- `CLAUDE.md`: working notes for AI-assisted development
