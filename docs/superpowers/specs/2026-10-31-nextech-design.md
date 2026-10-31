# NEXTECH — Design

Date: 2026-10-31 · Status: draft for owner approval

The owner's full requirements brief is in `2026-10-31-nextech-brief.md` (same folder, PT-BR, verbatim).
**The brief is the requirements baseline.** This document records the decisions taken on top of it
(owner decisions and builder calls), resolves its ambiguities, and wins where the two differ.
Items marked **[call]** are the designer's decisions that the owner has not explicitly confirmed.

---

## 1. Intent

NEXTECH is a monochrome (black / white / grey), premium, minimalist affiliate storefront: people
discover products, compare offers from partner stores and click through to buy there. NEXTECH earns
commissions; it never sells, takes payment or holds stock.

The owner wants **everything in the brief working and deploy-ready** in one delivery: public store,
full admin panel, tracking, affiliate integrations, four languages, SEO, tests. "Done" means:
the owner can deploy to Vercel + cloud Supabase by following the README, with no code changes.

### Why the honesty rules matter
The whole business rests on trust. Every number a visitor sees (price, old price, discount, rating,
availability) and every number the owner sees (clicks, conversions, commissions) must come from a
real source, and the system records *which* source (manual / imported / integration).

## 2. Current state

- The owner has **no affiliate accounts and no real products yet**. The store launches empty and is
  filled through the admin panel.
- New project, no code yet. Folder: `projetos/nextech` **[call]**.

## 3. Goals, non-goals, anti-goals

**Goals:** everything in the brief, plus the market/language decisions below.

**Non-goals (v1):**
- Checkout, payments, stock, orders (brief §15).
- User-written reviews. Ratings shown come only from the partner store/network and are labelled with their source.
- Web scraping of partner stores for prices **[call]**: prices come from manual entry, CSV import, or a
  network integration that legitimately provides them.
- Currency conversion. A price is shown exactly as the partner store states it, in its own currency.
- Translating the **admin panel UI**: admin UI is PT-BR only **[call]**. Content the admin enters is translatable (see §5).
- Native apps, newsletter, price-drop alerts.

**Anti-goals (a failure even if it "works"):**
- Any fake product, price, discount, rating, availability, click, conversion or commission shown as real.
- Any colour accent outside the palette. Generic-template look.
- Buttons/links that do nothing. Admin pages that are just visual.
- Secrets (Supabase service key, network credentials) reachable from the browser.
- Open redirects through `/go`.

## 4. Stack & environment (owner-approved as stated in chat, details **[call]**)

- Next.js (App Router, latest stable) + React + TypeScript (strict) + Tailwind CSS + shadcn/ui + Lucide.
- Supabase: Postgres, Auth, Storage. **Local dev on Supabase CLI in Docker, port range 558xx**
  (API 55821, DB 55822, Studio 55823, Inbucket 55824 …) — other local stacks already use 543xx, 553xx,
  554xx, 557xx, 565xx and must not be stopped. Dev server on **port 3300**.
- Schema lives in `supabase/migrations/*.sql`; deploy = `supabase db push` to a cloud project.
- Deploy target: Vercel. README (in English) documents every env var, cloud Supabase setup, auth
  redirect URLs, storage buckets, cron, first superadmin creation.
- Add the app's row to `projetos/local-dev/README.md` (local login, start command, ports).
- Git: init repo; work on a feature branch → `dev` → `main` only with owner approval. Never push
  until lint, typecheck, tests and build pass.

## 5. Languages and markets (owner decisions)

- **Locales:** `pt-BR` (default), `pt-PT`, `en`, `es`. Every public URL is locale-prefixed:
  `/pt-br/produtos`, `/pt-pt/…`, `/en/…`, `/es/…`. `/` redirects by `Accept-Language`, falling back to `pt-br`.
  Route segment names are localised **[call]**, e.g. `/pt-br/produto/[slug]`, `/en/product/[slug]`,
  `/es/producto/[slug]` (use next-intl pathnames or equivalent). `/admin` and `/go` are not localised.
- **Markets** are separate from languages **[call]**: a market is a country (ISO code). Each affiliate
  link (an "offer") belongs to one store, one market and one currency. Default market per locale:
  pt-BR→BR, pt-PT→PT, en→US, es→ES. A country selector in the footer (and the account preferences) overrides it;
  choice stored in a cookie. Markets available in the selector = markets that have at least one active store
  (managed in admin). The product page shows the offers for the current market. If the product has no offer in
  that market, it says so and lists the markets where it is available. It never shows a converted price.
- **Translatable content:** product name, short/long description, specs labels/values; category name and
  description; banner title/subtitle; campaign public texts; institutional pages (static, in message files).
  Stored in `*_translations` tables keyed by `(entity_id, locale)`. A missing translation falls back to pt-BR.
  Slugs are **one per entity, not per locale** **[call]** (simpler and avoids duplicate-content mistakes;
  hreflang links the locale versions).
- All UI strings for the store live in message files for the 4 locales; written by the builder, natural
  (not machine-literal) translations.
- Legal: LGPD (BR) and GDPR/RGPD (PT, ES and other EU). Cookie consent banner before any non-essential tracking.

## 6. Visual design

As in brief §2, strictly. Additional calls **[call]**:
- Font: Geist Sans (+ Geist Mono for SKUs/numbers in admin).
- Only six colours from the palette, plus `#FFFFFF` overlays with opacity. Status (active/inactive, errors)
  is conveyed by icon + text + weight/fill, never by colour. Form errors: black text with an alert icon and a
  dark-grey border.
- Charts (Recharts or equivalent): black/greys only, distinguish series by shade + dash pattern + direct labels.
- Category icons: picked from a curated set of Lucide icons in the admin.
- Light theme only for the store. No dark mode in v1 **[call]**.
- Motion: 150–200 ms opacity/transform transitions only.
- Homepage hero: text-led. An optional hero image can be set in site settings. Homepage banners (from admin) render
  as a single, restrained carousel *below* the hero only when active banners exist.

## 7. Public store

Everything in brief §4–§7, plus:

- **Empty states everywhere.** With no products the home page still looks finished: hero, categories (the 11
  initial categories are seeded as real config, not fake data — "Ofertas" is a link to the offers page, not a
  category row), and a calm "Novos produtos em breve" block instead of empty sections. Sections without data
  are hidden, not shown empty.
- **Prices & discounts:** each offer has `price`, `currency`, `price_updated_at`, `source`. Previous price
  and discount are shown **only** when a previous price is *proven*: there is an earlier price observation for that
  same offer in `product_prices` within the last 90 days (higher than the current price), **or** the admin entered an
  old price and ticked "verified" with a mandatory note/evidence URL **[call]**. The discount % is always computed,
  never typed. "Maior desconto comprovado" sorting uses only proven discounts.
- **Product price displayed on cards** = lowest current active offer in the visitor's market, with "a partir de" when
  there is more than one offer.
- **Ratings:** shown only if the admin entered a rating with its source (e.g. "Amazon, 1.234 avaliações").
- **Availability:** not shown unless an integration provides it **[call]**. No "em estoque" claims.
- **Popular:** ranked by real product views + affiliate clicks over the last 30 days; hidden until there is enough data
  (≥ 1 product with activity).
- **Search:** Postgres full-text search with `unaccent` + trigram similarity across translated name, brand,
  category, tags. Autocomplete endpoint (debounced, rate-limited) returns products, brands and categories.
  Searches are logged to `searches` (query, locale, results count; no user id unless logged in and consented).
- **Catalogue filters:** category, brand, store, price range (in the market's currency), minimum rating, "with proven
  discount"; sort as in the brief. Filter state lives in the URL (shareable, SEO-safe with canonical rules).
  Loading uses skeletons, plus no-results, error and results states.
- **Product page:** gallery with thumbnails, keyboard/swipe navigation and a zoom lightbox. All offers in the market are
  listed (store logo, price, updated date), with the best one as the main "VER PRODUTO NA LOJA" button.
  It includes the transparency notice, specs table, related products (same category, then shared tags), and "compra
  realizada na loja parceira" note.
- **/go/[productId]** (brief §6) with optional `?offer=<linkId>`; without it, the best offer for the visitor's market.
  Server route: looks up the active link, **validates the destination host against the store's allow-listed domains**
  (stored per store, plus each network's known redirect domains), records `affiliate_clicks`
  (timestamp, product, link, store, network, campaign from `utm_campaign`/campaign param, locale, market, referrer path
  only if analytics consent, hashed IP+UA with a daily rotating salt for dedupe and bot filtering; no raw IP stored),
  then 302 redirects with `rel="nofollow sponsored"` on the source links. Bots (UA list) are redirected but flagged
  and excluded from stats. It is rate-limited.
- **Favourites:** guests store them in localStorage; when they log in, those are merged into `favorites`. The heart
  button works on cards and product page.
- **Auth:** Supabase email + password, email confirmation, password recovery, logout. (Google login is not in v1 **[call]**.)
  Local email goes to Supabase Inbucket. Production SMTP is documented in the README.
- **Minha NEXTECH:** account info (name, email, change password), favourites, browsing history (on by default for
  logged-in users only after consent; user can pause and clear), preferences (language, country), privacy (cookie choices,
  export my data as JSON, delete account). Deleting the account removes the auth user and cascades all personal rows.
- **Institutional pages** (brief §12) in 4 languages: Sobre, Como funciona, Como ganhamos dinheiro, FAQ, Contato,
  Privacidade, Termos, Cookies, Aviso de afiliados. Legal texts are solid drafts that pull company name/contact
  from site settings, with a visible note in the README that they need legal review before launch. The **contact form**
  saves to `contact_messages` (rate-limited, honeypot) and appears in the admin under Clientes → Mensagens.

## 8. Admin panel

Everything in brief §8, under `/admin` (PT-BR UI), plus:

- **Sidebar** per brief §8.1 (collapsible, collapsed state remembered). Two extra items: **Marcas** (under Produtos)
  and **Administradores** (superadmin only). "Links de afiliados" is a dedicated list of all offers across products.
  "Relatórios" = CSV exports, "Analytics" = charts.
- **Header search** searches products, categories, stores, campaigns by name/slug/SKU.
- **Notifications** are computed, not fake **[call]**. They include offers whose price is older than N days (setting, default 14),
  offers/banners/campaigns starting or ending in the next 48 h, network sync failures, new contact messages and products
  without any active offer. A read state is stored per admin.
- **Dashboard** KPIs and charts per brief §8.2 with period filter (today/7/30/90/custom). Estimated, pending
  and confirmed commissions are always separate figures with labels. Empty data shows "sem dados ainda", never zeros
  dressed as results.
- **Products:** table + form per brief §8.3. Offers (affiliate links) are edited inside the product form as a
  repeatable section. Each offer has store, network, market, currency, original URL, affiliate URL (or "generate from
  network" when the adapter can build it, e.g. Amazon tag), price, previous price + verified flag + evidence, external
  ID/SKU and active flag. Changing a price writes a row to `product_prices`. Translations are tabs per locale in the form.
  Image upload to Supabase Storage with preview, reorder and choose main. Uses slug auto-generation with uniqueness check.
  "Desempenho" shows views/clicks/conversions for that product. **Bulk:** CSV import/export of products and
  offers **[call]**, which helps the owner fill the store fast.
- **Categories, Brands, Stores** per brief §8.4–8.5. Stores also hold allow-listed domains and markets served.
- **Affiliate networks** (brief §8.6) — see §10.
- **Offers** (brief §8.7): an "oferta" here is a promotion entry pointing to a product + period + highlight + schedule.
  It requires the product to have a proven discount *or* the admin to state the reason (e.g. "Black Friday na loja X")
  **[call]**. It never computes a discount that isn't proven.
- **Banners** with live preview at desktop and mobile widths before publishing; schedule by dates.
- **Campaigns** (brief §8.9): products + banners + dates + status. Clicks are attributed via `campaign` param on `/go`
  links generated from campaign surfaces (banners, campaign landing page `/[locale]/campanha/[slug]`) **[call]**.
  "Resultados" shows the conversions whose network sub-ID maps back to the click (see §10).
- **Clientes:** list of registered users (name, email, signup date, favourites count, last activity), with contact
  messages inbox. Visible to superadmin and admin; no personal data export except by superadmin.
- **Admins & roles** per brief §8.11. Roles and permissions are seeded rows (`admin_roles`, `admin_permissions`,
  role↔permission). Checks happen in **both** server code (`requirePermission('products.write')` in every action/route)
  **and** RLS (`has_admin_permission()` SQL function). Superadmin can invite admins by email and change roles.
  The **first superadmin** is created by `npm run admin:create -- <email>` (works locally and against cloud with the
  service key from env).
- **Audit log** (`admin_audit_log`): every create/update/delete/publish/role change/credential change stores who, what, when and
  a diff summary, shown under Configurações → Logs.
- **Settings** per brief §8.12 in `site_settings` (typed keys). This includes store name, logo, favicon, institutional text, contact
  email, socials, default SEO, analytics (e.g. optional GA4/Plausible ID, loaded only after consent), cookie banner
  texts, legal entity info, price-staleness threshold.

## 9. Data model

All brief §9 tables, plus: `product_translations`, `category_translations`, `banner_translations`,
`campaign_translations`, `campaign_banners`, `admin_role_permissions`, `store_domains`, `markets`,
`network_credentials` (encrypted), `network_sync_runs`, `contact_messages`, `admin_notifications_read`,
`admin_audit_log`, `rate_limits`, `product_tags`/`tags`.

Rules:
- UUID PKs, `created_at`/`updated_at` with trigger, FKs with explicit `on delete` behaviour, check constraints
  (prices ≥ 0, rating 0–5, currency ISO-4217 3 letters, locale in the 4 allowed), unique slugs, indexes on every FK and
  on hot filters (status, category, market, created_at on events).
- Every externally-sourced fact (`product_prices`, ratings, `affiliate_conversions`, `affiliate_commissions`) has
  `source` ∈ {`manual`, `import`, `integration`} + `source_ref` (file name / network / run id).
- Conversions and commissions have `status` ∈ {`pending`, `confirmed`, `rejected`} and store `external_id` unique per network.
  "Estimated" = the sum of pending amounts as reported by the network, never computed by NEXTECH from clicks.
- `affiliate_clicks` and `analytics_events` are append-only and readable only by admins with `analytics.read`. They are inserted
  only by server code (service role), never directly by the browser.
- **RLS on every table.** Public can read only published/active catalogue rows. Users read/write only their own `profiles`,
  `favorites`, `browsing_history`. Admin tables are restricted by permission function. `network_credentials` has no policy
  for any client role (service role only).
- Storage buckets: `products`, `categories`, `brands`, `stores`, `banners`, `site` — public read, write only by admins with the
  matching permission (storage policies).
- Event retention: raw click/event rows are kept 13 months, then aggregated into daily rollups and deleted **[call]**.

## 10. Affiliate integrations

- One adapter per network behind a common interface, but **capabilities differ per adapter** (no assumption of identical
  APIs). Each adapter declares what it supports: `buildAffiliateUrl`, `testConnection`, `fetchConversions(range)`,
  `fetchCommissions(range)`, `parseReportCsv(file)`.
- Adapters in v1:
  - **Amazon Associates:** build URL by adding the store tag (per market: amazon.com.br, .es, .com …). Conversions and earnings
    are imported from the Associates **report CSV** (no reporting API assumed). PA-API is not used in v1.
  - **Awin, Admitad, Impact:** API clients for transactions/actions based on each network's current official
    publisher API docs (the builder must read them, not guess), plus each network's CSV export as a fallback.
  - **Generic / other:** manual URL + CSV import with column mapping.
- Sub-ID / click ID: when the network supports a sub-ID parameter, `/go` appends NEXTECH's click id so conversions can be
  matched to product/campaign. The parameter name is configured per network.
- **Credentials** are encrypted with AES-256-GCM using `NETWORK_CREDENTIALS_KEY` (server env) and stored in `network_credentials`.
  The UI only shows "configurado / last 4 chars" and can replace or delete them, never read them back.
- **Sync:** "Sincronizar agora" button + a scheduled job (Vercel Cron → protected route with `CRON_SECRET`, daily) per network
  with API capability. Each run is logged in `network_sync_runs` with counts and errors, and is idempotent (upsert by external_id).
- Honesty: because no accounts exist yet, API adapters can be tested only against recorded fixtures shaped like the documented
  responses. The README and the admin UI state which adapters were verified against a live account (none at delivery).

## 11. Security

Brief §11 in full, concretely: zod validation on every action/route; React escaping + sanitised rich text (product
descriptions use a restricted Markdown → HTML sanitiser); only parameterised queries via Supabase client/RPC; Postgres-backed rate
limiting (works on serverless) on `/go`, search suggest, auth forms, contact form; admin routes guarded in middleware **and** each
server action; security headers (CSP, HSTS, frame-ancestors none, referrer-policy); service key only in server modules
(`server-only`); URL validation for every admin-entered external URL (https only, host allow-list for offers); errors logged
server-side with a friendly page client-side; no payment data anywhere.

## 12. SEO & performance

Brief §13: `generateMetadata` per page and locale, hreflang alternates, canonical URLs, `sitemap.xml` (all locales, products,
categories, campaigns), `robots.txt` (disallow `/admin`, `/go`, account), Open Graph images (generated per product), JSON-LD
(`Organization`, `WebSite` + SearchAction, `Product` with `Offer` per offer; `AggregateRating` only when a sourced rating exists),
`next/image` with Supabase loader, ISR/revalidation tags so admin edits show up within seconds. Target: Lighthouse ≥ 90 on mobile
for home, catalogue and product page.

## 13. Demo data

`npm run db:seed:demo` fills the **local** database with clearly fictional products ("Produto de demonstração") so the owner can
see the store full. It refuses to run against a non-local Supabase URL. It never goes into migrations. The categories, roles,
permissions, markets and default settings are real config and live in migrations/seed.

## 14. Testing & definition of done

- Unit tests (Vitest) for the logic: discount proof, best-offer selection, URL/host validation, permission checks,
  adapters (against fixtures), CSV parsers, slug generation, rate limiter.
- DB tests: RLS policies (a normal user cannot read another's favourites or any admin table; an editor cannot touch settings) —
  run against the local Supabase.
- E2E (Playwright) smoke paths: browse → search → product → `/go` records a click and redirects; sign-up → favourite → delete
  account; admin login → create store, network, product with offer → appears in the store; role restriction blocks an editor.
- Done = lint + typecheck + unit + DB + e2e + `next build` all green locally, app runs on :3300 against local Supabase, README
  deploy steps complete. The owner reviews before anything merges to `main`.

## 15. Resolutions from the builder check (all **[call]**)

1. **Offers without a displayed price.** Price is optional per offer. Each network/store has a `price_display_policy`:
   `show` (manual/import/integration price allowed) or `link_only`. **Amazon defaults to `link_only`**: the button says "Ver preço na
   Amazon" and no Amazon price, rating or review count is shown, because Associates terms only allow showing prices fetched via PA-API and
   kept fresh, and PA-API needs qualifying sales first. A PA-API adapter is built behind a flag. Once credentials work, it
   refreshes prices at most every 24 h and switches Amazon offers to `show`, with prices older than 24 h hidden automatically. Everything
   that uses prices handles priceless offers: "a partir de" ignores them, price sort and filter put them last or exclude them, no discount
   proof, and the JSON-LD `Offer` has no `price` (so it is omitted), plus no staleness notification. Any other network can be set to `link_only` too.
2. **Consent and tracking.** Without consent the server records only **anonymous, identifier-free events**: product view, search
   query + result count, and `/go` click with product/link/store/network/campaign/locale/market/timestamp and a bot flag. No IP, no hash,
   no session id, no referrer. That legitimately drives "Mais populares", click counts and CTR. Rate limiting uses an in-memory/DB key
   derived from IP that expires within minutes and is never joined to events. With **analytics consent**, events also carry an anonymous
   session id (first-party cookie) and the referrer path. Optional third-party analytics (GA4/Plausible) load only with consent. The
   cookie banner has three categories: essential (always), analytics, marketing (unused in v1, but the category exists). The policies
   describe exactly this.
3. **Role × permission matrix** (seeded, editable later only by superadmin):

   | Permission area | Superadmin | Admin | Editor |
   |---|---|---|---|
   | Products, brands, categories, tags (write) | ✓ | ✓ | ✓ (no delete) |
   | Product CSV import/export | ✓ | ✓ | — |
   | Offers / affiliate links (write) | ✓ | ✓ | ✓ (no delete) |
   | Stores (write) | ✓ | ✓ | — |
   | Affiliate networks + credentials + sync | ✓ | — (read only, no credentials) | — |
   | Promotions ("Ofertas"), banners, campaigns | ✓ | ✓ | ✓ |
   | Analytics + CSV reports (read) | ✓ | ✓ | — |
   | Conversions/commissions import | ✓ | ✓ | — |
   | Customers + contact messages | ✓ | ✓ (read, no export) | — |
   | Site settings, legal info | ✓ | — | — |
   | Admin users & roles | ✓ | — | — |
   | Audit log (read) | ✓ | ✓ | — |
4. **Multiple currencies in admin.** No conversion anywhere. Commission KPIs, charts, campaign results and CSV exports are **grouped by
   currency** (e.g. "Confirmadas: R$ 1.240,00 · € 85,00"). Charts take a currency selector that defaults to the currency with the most volume.
5. **Browsing history is opt-in**: off by default, and the user turns it on in Minha NEXTECH → Privacidade (a short prompt with the toggle
   appears once after the first login). Pausing stops recording; "limpar" deletes all rows.

## 16. Left to the builder

Library choices within the stack (next-intl, Recharts, react-hook-form, etc.), folder structure, component breakdown,
exact table columns beyond what is stated, copywriting (on-brand, sober, transparent), icon choices, exact rate-limit numbers,
build order (the brief's 6 stages are a fine order, but each stage must end working).
