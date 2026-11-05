# Deploy today: Brazil own store (loja própria)

Production goes from the Amazon ES/PT affiliate site (`main`) to the Brazil own store (`dev` → `fix/launch`). Follow the steps **in order**. Nothing here needs a code change; every value comes from a dashboard, never from this repo or a chat.

Cloud Supabase project: `yeqensrclrxbeikfksdf` ("Nextech", NexForge org, replaces the old `orpzevxfdycppepkhanp`). Pending migrations on it (checked with `npx supabase migration list --linked` on 2026-11-02): `20261102000017` … `20261102000024`. `fix/launch` adds no new migrations. Production (Vercel `nex-forge5/nextech`) still points at the old project until its `NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_SERVICE_ROLE_KEY` are switched in step 3.

> **What changes for visitors as soon as 0017 is applied:** `public.business_models` is created as `{own_store: true, affiliates: false}`. Affiliate products (Amazon ES/PT) are hidden, `/go/*` stops redirecting, and `/es`, `/pt-pt`, `/en` URLs redirect to `/pt-br`. The catalogue shows only own-store products, so create at least one before announcing the launch (step 9).

## 0. Before you start

- Stripe Brazil account activated (CPF or the MEI's CNPJ, BRL bank account in the same name). Boleto enabled in Stripe → Settings → Payment methods. Pix stays off until Stripe approves it.
- The company data you will publish: razão social, CNPJ, full address, customer-service e-mail. Decreto 7.962/2013 requires them on the site.
- Production domain decided (below: `https://<domain>`).

## 1. Back up the cloud database

1. Supabase Dashboard → Database → Backups: check there is a recent backup (or create one).
2. Plus a local dump (needs Docker running; files stay outside git — never commit them):

```bash
npx supabase db dump --linked -f ../nextech-backup-schema-$(date +%F).sql
npx supabase db dump --linked --data-only -f ../nextech-backup-data-$(date +%F).sql
```

## 2. Stripe webhook endpoint (live mode)

Stripe Dashboard (live mode) → Developers → Webhooks → Add endpoint:

- URL: `https://<domain>/api/stripe/webhook`
- API version: the account default.
- Events (exactly these 8):
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `payment_intent.canceled`
  - `charge.refunded`
  - `refund.created`
  - `refund.updated`
  - `charge.dispute.created`
  - `charge.dispute.closed`

Copy the endpoint's **Signing secret** (`whsec_…`) for step 3. Deliveries fail (404) until step 5 is deployed; Stripe retries, and no payments exist before that anyway.

## 3. Vercel environment variables (Production)

Vercel → Project → Settings → Environment Variables, scope **Production** (use test keys in **Preview** if you want a dry run there first).

| Variable | Where the value comes from |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | The production domain, `https://<domain>`, no trailing slash |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL (already set today) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → publishable key `sb_publishable_…` (already set today) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → secret key `sb_secret_…` (already set today) |
| `NETWORK_CREDENTIALS_KEY` | Keep the existing value (encrypts affiliate network credentials). New only if absent: `openssl rand -base64 32` |
| `CRON_SECRET` | Keep the existing value, or `openssl rand -hex 32`. Vercel Cron sends it to `/api/cron/sync`, `/api/cron/retention`, `/api/cron/orders` |
| `STRIPE_SECRET_KEY` | Stripe (live) → Developers → API keys → Secret key `sk_live_…` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe (live) → Developers → API keys → Publishable key `pk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | Step 2, endpoint signing secret `whsec_…` |
| `RESEND_API_KEY` | Resend → API Keys → create a "Sending access" key for the domain (step 6) |
| `EMAIL_FROM` | A sender on the verified Resend domain, e.g. `NEXTECH <pedidos@<domain>>` |
| `OWNER_ALERT_EMAIL` | The owner's inbox for new paid orders, disputes and manual refunds |
| `BUSINESS_MODELS_PROXY_TTL_MS` | Optional; leave unset (30 s cache of the business-model switch) |

Without the Stripe keys the checkout shows "pagamentos ainda não configurados"; without Resend the order emails are skipped (logged as `email_skipped` in the order history). The admin dashboard lists anything missing (names only).

## 4. Apply the migrations

```bash
npx supabase link --project-ref yeqensrclrxbeikfksdf   # already linked in this repo
npx supabase db push --linked --dry-run                 # must list exactly the pending ones, up to the latest in supabase/migrations (0030)
npx supabase db push --linked
npx supabase migration list --linked                    # local = remote for every row
```

Do step 5 right after this one: between the two, the old affiliate code runs against a database where affiliates are off, so its catalogue looks empty.

## 5. Deploy the code

1. Merge `fix/launch` → `dev` → `main` (after approval), push `main`.
2. Wait for the Vercel production deployment to finish; check its build log has no errors.
3. `GET https://<domain>/api/health` → `{"ok":true}`.

## 6. Resend domain

Resend → Domains → Add `<domain>` (or a subdomain such as `mail.<domain>`), region closest to Brazil (São Paulo when offered). Add the DNS records it shows at your DNS provider — the SPF `TXT` + `MX` on the `send` subdomain and the DKIM `TXT` `resend._domainkey` — and a DMARC record if you have none (`_dmarc` TXT `v=DMARC1; p=none;`). Wait for **Verified**. `EMAIL_FROM` must use this domain.

## 7. Supabase Auth

Supabase Dashboard → Authentication:

1. **URL Configuration:** Site URL `https://<domain>`. Redirect URLs: `https://<domain>/**` (keep `http://localhost:3300/**` for development).
2. **SMTP Settings:** enable custom SMTP (the built-in sender is rate-limited). With Resend: host `smtp.resend.com`, port `465`, user `resend`, password = a Resend API key, sender = an address on the verified domain.
3. **Providers → Email:** minimum password length **8** (the repo's `supabase/config.toml` only affects the local stack); enable leaked-password protection if the plan allows.
4. **Email templates:** subjects/texts in Portuguese (confirm sign-up, reset password).

## 8. Admin settings (`https://<domain>/admin` → Configurações)

1. **Informações legais:** razão social, CNPJ, endereço completo (rua, número, bairro, cidade/UF, CEP) — exactly as in the CNPJ card. Shown in the footer, checkout, terms, privacy policy and customer emails.
2. **Contato e redes sociais:** e-mail de contato (customer service / privacy channel).
3. **Modelos de negócio:** loja própria **on**, afiliados **off**; payments: cartão on, boleto on, Pix off until Stripe approves it.
4. **Loja / SEO:** store name, logo, favicon, pt-BR SEO title and description.
5. **Analytics (optional):** GA4 / Google Ads / Meta Pixel IDs. They load only after cookie consent and receive Google Consent Mode v2 signals.
6. Back on **Visão geral**: the "Pendências para vender na loja própria" box must be gone.

## 9. Catalogue

At least one product with sale mode "loja própria": price, delivery days (min/max, business days), stock, photos, description, and its private supplier. Published.

## 10. Smoke test (production)

- [ ] `/` → `/pt-br`; `/es`, `/pt-pt`, `/en/products` redirect to the pt-BR equivalent.
- [ ] Footer shows razão social · CNPJ · endereço · e-mail, plus Termos, Privacidade, Trocas e devoluções, Entrega, Cookies; no affiliate disclosure, no "Como ganhamos dinheiro".
- [ ] `/pt-br/termos`, `/privacidade`, `/trocas-e-devolucoes`, `/entrega` show the store texts with the real company data (no `{{…}}`, no "[a definir]").
- [ ] `/sitemap.xml` lists only `/pt-br/...` URLs and own-store products; `/robots.txt` blocks `/admin`, `/go/`, `/api/`, cart and checkout; `/manifest.webmanifest` loads.
- [ ] Product page: price with free shipping, delivery estimate, stock, "Vendido e entregue por …"; no "ver na loja" / `/go/` links.
- [ ] Cookie banner: reject → no Google/Meta requests; accept → tags load (Google Tag Assistant shows consent default denied, then granted).
- [ ] Sign up (confirmation email arrives from your domain), sign in.
- [ ] Cart → checkout: items, "Frete Grátis", total, delivery estimate, seller line and the terms/7-day notice are visible **before** paying.
- [ ] Real purchase with your own card (small amount): success page, order in Minha conta → Pedidos, confirmation email (with the 7-day notice and terms link), owner alert email, Stripe webhook delivery `200`, order "Aguardando compra" in `/admin/pedidos`.
- [ ] Refund it from `/admin/pedidos/<n>`: Stripe shows the refund, the order turns "Reembolsado", refund email arrives.
- [ ] Boleto: generate one (do not pay); the voucher opens; it is cancelled automatically after 4 days by `/api/cron/orders`.
- [ ] Cron check: `curl -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/orders` → `{"ok":true,…}` (and `401` without the header).
- [ ] Stripe → Webhooks → the endpoint shows no failed deliveries.

## Rollback

- Code: in Vercel, promote the previous production deployment (the affiliate site).
- Data: the affiliate site needs affiliates on — in `site_settings`, set `public.business_models` to `{"own_store": false, "affiliates": true, ...}` (Admin → Configurações → Modelos de negócio). Migrations 0017–0030 only add objects and replace functions with the same signatures; restore from the step 1 backup only if something is actually corrupted.

## Decisions taken in `fix/launch`

- **Locales.** The code already ties locales to the business model: with affiliates off the storefront is pt-BR/BRL only and other locale prefixes redirect (temporary redirect, because affiliates can be switched back on). The other locales were kept, not removed. Canonical URLs, hreflang alternates and the sitemap now list only the locales actually served, so search engines are not sent to redirecting URLs; the primary locale and `x-default` are pt-BR.
- **Seller data.** Never hard-coded: it comes from `public.legal` and `public.contact_email`. Missing fields are omitted for customers (no placeholders) and reported to the admin on the dashboard and in the settings tab.
- **Legal texts.** pt-BR own-store terms, returns, privacy and FAQ were reviewed against CDC art. 49, Decreto 7.962/2013 and the LGPD. They are a solid base, **not legal advice**: have a lawyer review them before or soon after launch, especially if you add Pix, installments, marketplaces or sell to companies.
