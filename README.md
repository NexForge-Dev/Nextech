# NEXTECH

Minimalist, monochrome affiliate marketplace. Shoppers discover and compare products; purchases happen at partner stores through tracked affiliate links (`/go/[productId]`). Four locales: `pt-BR` (default), `pt-PT`, `en`, `es`.

- **Stack:** Next.js 16 (App Router, `src/proxy.ts` instead of middleware), React 19, Tailwind 4 + shadcn, next-intl, Supabase (Postgres, Auth, Storage), Vitest + Playwright.
- **Product docs:** `docs/superpowers/specs/` (brief and design), `docs/superpowers/plans/` (implementation plan).

## Environments

| | Supabase | Used by |
|---|---|---|
| **Cloud** | project `orpzevxfdycppepkhanp` | `npm run dev`, `build`, production (Vercel) |
| **Local** | `npx supabase start` (API `127.0.0.1:55821`, Studio `:55823`) | `test:db`, `test:e2e` |

`.env.local` points at the cloud project. To work against the local stack, swap in the local URL/keys (`npx supabase status`).

## Environment variables

See `.env.example`.

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URL, no trailing slash |
| `NEXT_PUBLIC_SUPABASE_URL` | public | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | `sb_publishable_…` (falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | `sb_secret_…` or legacy service_role JWT — bypasses RLS |
| `NETWORK_CREDENTIALS_KEY` | server | 32 random bytes, base64 — encrypts affiliate network credentials |
| `CRON_SECRET` | server | Shared secret for `/api/cron/*` |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3300
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js on port 3300 |
| `npm run verify` | lint + typecheck + unit tests |
| `npm test` | Vitest unit tests |
| `npm run test:db` | Database/RLS tests (local stack) |
| `npm run test:e2e` | Playwright end-to-end tests (local stack) |
| `npm run db:start` / `db:stop` / `db:reset` | Local Supabase stack |
| `npm run db:types` | Regenerate `src/lib/supabase/types.ts` from the local stack |
| `npm run admin:create -- <email> [--role superadmin\|admin\|editor] [--password <p>]` | Create or promote an admin user |
| `npm run db:seed:demo` | Load demo catalogue data (never in production) |

## Database

Migrations live in `supabase/migrations/`; `supabase/seed.sql` holds base configuration only (admin roles and permissions) and is idempotent.

```bash
npx supabase link --project-ref orpzevxfdycppepkhanp
npx supabase db push --linked --dry-run   # review
npx supabase db push --linked             # apply migrations
npx supabase db push --linked --include-seed
```

## Admin

The panel lives at `/admin` (sign in at `/admin/entrar`). Bootstrap the first superadmin with `npm run admin:create`.

## Deploy (Vercel)

1. Set every variable from the table above in the Vercel project. `NEXT_PUBLIC_SITE_URL` must be the production domain.
2. In Supabase → Authentication → URL Configuration, set **Site URL** to the production domain and add `https://<domain>/**` and `http://localhost:3300/**` to **Redirect URLs**.
3. Configure custom SMTP in Supabase (the built-in sender is rate-limited and not meant for production).
4. Crons are declared in `vercel.json`: `/api/cron/sync` (04:00 UTC) and `/api/cron/retention` (04:30 UTC). They authenticate with `CRON_SECRET`.
5. Health check: `GET /api/health` → `{"ok":true}`.
