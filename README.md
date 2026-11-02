# NEXTECH

Minimalist, monochrome electronics store for Brazil with two switchable business models:

- **Own store (active):** cart → in-site Stripe checkout (card, boleto; Pix behind a switch) → orders managed in `/admin/pedidos`, where the owner buys each item from a supplier, records cost and tracking, refunds and handles returns.
- **Affiliates (off, preserved):** product pages link to partner stores through tracked affiliate links (`/go/[productId]`). Nothing was removed; switch it back on in Admin → Configurações → Modelos de negócio.

While affiliates are off the storefront is pt-BR/BRL only (other locales redirect to pt-BR). With affiliates on, the four locales return: `pt-BR` (default), `pt-PT`, `en`, `es`.

- **Stack:** Next.js 16 (App Router, `src/proxy.ts` instead of middleware), React 19, Tailwind 4 + shadcn, next-intl, Supabase (Postgres, Auth, Storage), Vitest + Playwright.
- **Product docs:** `docs/superpowers/specs/` (brief and design), `docs/superpowers/plans/` (implementation plan).

## Environments

| | Supabase | Used by |
|---|---|---|
| **Cloud** | project `yeqensrclrxbeikfksdf` | `npm run dev`, `build`, production (Vercel) |
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
| `CRON_SECRET` | server | Shared secret for `/api/cron/*` (sync, retention, orders) |
| `STRIPE_SECRET_KEY` | server | `sk_test_…` in development, `sk_live_…` only in Vercel production. Checkout shows "pagamentos ainda não configurados" without it |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public | `pk_test_…` / `pk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | server | Signing secret of the `/api/stripe/webhook` endpoint |
| `RESEND_API_KEY`, `EMAIL_FROM` | server | Transactional email. Without them emails are logged and skipped |
| `OWNER_ALERT_EMAIL` | server | Receives "new paid order", dispute and manual-refund alerts |
| `BUSINESS_MODELS_PROXY_TTL_MS` | server | Optional; how long the proxy caches the business-model switches (default 30000) |

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
npx supabase link --project-ref yeqensrclrxbeikfksdf
npx supabase db push --linked --dry-run   # review
npx supabase db push --linked             # apply migrations
npx supabase db push --linked --include-seed
```

## Admin

The panel lives at `/admin` (sign in at `/admin/entrar`). Bootstrap the first superadmin with `npm run admin:create`.

## Deploy (Vercel)

Step-by-step production launch of the own store: [`docs/DEPLOY-TODAY.md`](docs/DEPLOY-TODAY.md).


1. Set every variable from the table above in the Vercel project. `NEXT_PUBLIC_SITE_URL` must be the production domain.
2. In Supabase → Authentication → URL Configuration, set **Site URL** to the production domain and add `https://<domain>/**` and `http://localhost:3300/**` to **Redirect URLs**.
3. Configure custom SMTP in Supabase (the built-in sender is rate-limited and not meant for production).
4. Crons are declared in `vercel.json`: `/api/cron/sync` (04:00 UTC) and `/api/cron/retention` (04:30 UTC). They authenticate with `CRON_SECRET`.
5. Health check: `GET /api/health` → `{"ok":true}`.

## Own store (loja própria)

**Flow.** The cart lives in the browser (`nx_cart_v1`); prices are always recomputed on the server. `create_order_from_cart` (SQL) creates the order from `product_sale`, then one Stripe PaymentIntent is created for exactly the order total (idempotency key `order-<id>`). Card is confirmed in the browser with the Payment Element; boleto and Pix are confirmed server-side and show the voucher / QR code. **Only the webhook marks an order paid.**

**Stripe setup**

1. Create the Stripe Brazil account (CPF or the MEI's CNPJ, BRL bank account in the same name). Request Pix access (invite-only on Stripe Brazil), then turn Pix on in Admin → Configurações → Modelos de negócio.
2. Add the test keys to `.env.local` (never paste keys into chats or commits).
3. Webhook endpoint `https://<domain>/api/stripe/webhook` with events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `refund.created`, `refund.updated`, `charge.dispute.created`, `charge.dispute.closed`. Locally: `stripe listen --forward-to localhost:3300/api/stripe/webhook` and use the printed `whsec_…` as `STRIPE_WEBHOOK_SECRET`.
4. Test card `4242 4242 4242 4242`, any future date, any CVC.

**Facts that shaped the design.** Stripe Brazil has no installments (parcelamento), so it is not offered. Boleto cannot be refunded through Stripe: refund by Pix/transfer and record it as "reembolsado por fora" in the order. Card payouts settle in 30 days; boleto/Pix in ~2 business days.

**Orders.** Statuses: awaiting_payment → (webhook) awaiting_supplier → supplier_purchased (first item bought) → shipped → in_transit → delivered; plus cancelled / refunded. Customers see a simplified timeline and never see supplier data: they read orders only through the `my_orders` / `my_order_items` views; admin pages use the service role after `pageGuard("orders.read")`. Customers can cancel only until any item is bought at a supplier (enforced in SQL).

**Abandoned orders.** `/api/cron/orders` (daily, Vercel Cron) cancels unpaid orders — boleto 4 days after creation (3-day expiry + 1), card/Pix after 1 day — and their PaymentIntents. A payment that still succeeds on a cancelled order is refunded automatically (card/Pix) or flagged for a manual refund (boleto).

**Email.** `src/lib/email` (Resend HTTP API, pt-BR templates). Missing env → skipped and recorded as `email_skipped` in the order history.

**Legal texts.** Own-store versions live in `src/content/legal/pt-BR/store/` (terms of sale, privacy, cookies, returns, shipping, FAQ, about) and are used while the own store is on. Fill Admin → Configurações → Informações legais (razão social, CNPJ, address) and the contact e-mail — the footer, checkout, legal pages and customer emails show the seller identity required by Decreto 7.962/2013. Missing fields are omitted for customers (never placeholders) and listed on the admin dashboard until filled.

**Consent.** Analytics/marketing tags load only after consent; Google tags get Consent Mode v2 (`ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`: denied by default, then the banner choice).

**Tests against the local stack**

```bash
npx supabase start && npx supabase db reset && npm run db:seed:demo
set -a; . ./.env.local.localstack; set +a         # local Supabase env (bash)
npm run test:db
E2E_PORT=3310 BUSINESS_MODELS_PROXY_TTL_MS=0 npx playwright test   # isolated production build on :3310
```
