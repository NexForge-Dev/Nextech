# NEXTECH own store (loja própria) — design

Date: 2026-11-02 · Status: approved in conversation, pending written review

## 1. Intent and why

NEXTECH today is an affiliate marketplace: products are shown and the buy button redirects to partner stores (`/go/[productId]`). The owner wants NEXTECH to become **their own electronics store for Brazil**: the customer adds products to a cart, pays inside NEXTECH with Stripe, and the order is stored in NEXTECH. After payment is confirmed, the owner **buys the product manually** at a supplier (Amazon BR, Mercado Livre, AliExpress or others), shipping directly to the customer's address, and tracks the order in the admin until delivery.

Why: the owner wants the customer to see prices and pay inside their own platform (they will drive traffic with Facebook/Google Ads), and to set their own price and margin instead of earning affiliate commission.

The affiliate model is **not removed**. It is preserved intact and switched off, so it can be turned back on later, globally or per product.

The owner is a Brazilian MEI-to-be (has CPF + Brazilian bank account; will open an MEI). They currently live in Spain; Spain/Portugal selling was explicitly dropped for now because of the fiscal/legal weight there.

## 2. Goals

1. A conventional, professional e-commerce flow in pt-BR, BRL, Brazil market: product page with price → cart → checkout (address + payment) → confirmation → "Meus pedidos" with tracking.
2. Real Stripe payments (test mode for development, live later), confirmed only by Stripe webhooks. Card (credit/debit, single payment) and boleto in v1. Pix built but disabled until Stripe approves it for the account (Pix is invite-only on Stripe Brazil).
3. Admin order management: list, detail, manual status updates, supplier purchase data (where bought, cost, supplier order number, purchase link, tracking code), refunds, attached invoice (nota fiscal), full order history, per-order and per-product margin.
4. Product management extended with own-store fields: sale mode, sale price, optional "from" price, Pix discount %, availability, delivery estimate, private supplier list with cost.
5. Customer self-service: account (already exists), orders, tracking, request return/support, cancel before the supplier purchase.
6. Business-model switches in admin settings: Own store ON/OFF, Affiliates ON/OFF, independently; per-product sale mode (own or affiliate) so both can coexist in the future.
7. Transactional emails to the customer and new-order alerts to the owner.

## 3. Non-goals (v1)

- Automatic purchasing at suppliers (APIs/agents). Keep the code organised so it can be added later (supplier purchase is a separate step/record per order item).
- Installments (parcelamento). Stripe Brazil does not document installments and does not support customer-paid interest. The owner wanted per-product installments with per-product interest; this is **deferred** until a provider supports it. Do not build the fields now.
- Automatic nota fiscal emission (MEI is generally exempt for sales to individuals unless requested; the owner attaches a PDF manually when they issue one).
- Spain/Portugal/other markets for the own store. Own-store products are sold only in market `BR`, currency `BRL`, locale pt-BR. (The existing multi-locale/multi-market structure stays; own-store simply only offers BR.)
- Guest checkout. An account is required to finish a purchase.
- Inventory quantities. Availability is a flag (in stock / sold out); real stock is the supplier's.
- Shipping calculation. Shipping is always free to the customer; the owner bakes shipping into the sale price.

## 4. Anti-goals (would make this a failure even if it "works")

- Any customer-facing redirect to Amazon/AliExpress/any marketplace to pay, or any visible supplier name/link to the customer while own store is active.
- Marking an order paid because the customer reached the success page (only webhooks confirm).
- Charging twice, creating duplicate orders, or processing a webhook event twice.
- Deleting or breaking affiliate tables, data, admin screens, `/go` logic, adapters, crons or settings.
- Mixing the Stripe payment flow into the affiliate flow (separate tables/code paths).
- Secret keys reaching the browser.
- Trusting client-sent prices (server recomputes every total from the database).

## 5. Decisions made with the owner

**Customer flow (approved on mockup `loja-fluxo-cliente.html`):**
- Product page: sale price, optional strike-through "from" price, Pix price with discount badge (shown only while Pix is enabled), "Frete grátis · chega em X a Y dias úteis", availability, "Adicionar ao carrinho" and "Comprar agora", footer line "Vendido e entregue por NEXTECH · 7 dias para desistir · garantia de 90 dias".
- Cart: items, quantity +/−, remove, subtotal, shipping "Grátis", total, "Finalizar compra"; finishing requires sign-in/sign-up.
- Checkout inside NEXTECH: delivery address with CEP auto-fill, full name, CPF (required for boleto), phone; payment method selection: card (default), boleto ("confirma em até 1 dia útil"), Pix ("em breve" while disabled); "Pagar R$ X"; "Pagamento processado com segurança pelo Stripe".
- Order page for the customer: simplified timeline — Pagamento confirmado → Em preparação → Enviado (carrier + tracking code + link) → Entregue; plus Cancelado/Reembolsado when applicable. Customer never sees supplier info.
- "Cancelar pedido" is available only until the owner registers the supplier purchase; after that only "Solicitar devolução ou suporte".

**Order statuses (admin, manual updates allowed for all):** Aguardando pagamento · Pagamento confirmado · Aguardando compra do fornecedor · Produto comprado no fornecedor · Produto enviado · Em trânsito · Entregue · Cancelado · Reembolsado.
Customer-facing mapping: Aguardando pagamento → "Aguardando pagamento"; Pagamento confirmado / Aguardando compra / Comprado no fornecedor → "Em preparação" (first step shows "Pagamento confirmado"); Enviado / Em trânsito → "Enviado"; Entregue; Cancelado; Reembolsado.

**Payments:** Stripe only (owner's decision, consistent with all their apps). Card single payment + boleto in v1; Pix implemented behind a setting, off by default. The UI must not promise Pix while it is off.

**Pricing:** sale price set per product by the owner, independent of supplier price; free shipping baked in; Pix discount % per product (applies only when Pix is enabled and chosen).

**Supplier unavailable / price jumped after payment:** owner tries another supplier; otherwise cancels and refunds 100% from the admin with one action; the customer gets an email.

**Returns/defects (Brazil CDC: 7 days withdrawal for online purchases, 90 days legal warranty for durables):** customer opens a request from "Meus pedidos" (reason: desistência / defeito / outro, message, optional photos). Owner handles it outside (e.g. opens the return at Amazon with their account) and records the outcome in admin: full refund, partial refund, replacement, or refused (with note).

**Admin (approved on mockup `admin-pedido.html`):**
- Orders list with filters (status, payment status, period, search by name/email/number) and a highlight of how many await supplier purchase.
- Order detail: customer contact, masked CPF, delivery address with "copy" button, items; per item the suggested supplier with link and expected cost, and fields: where bought (supplier), amount paid, supplier order number, purchase link, tracking code; money block: received, Stripe fee, supplier cost, gross margin (amount and %); actions: save, refund, attach nota fiscal; status selector; chronological history (payment events, emails sent, admin changes with who/when).
- Product form: new "Venda própria" section — sale mode (own / affiliate), sale price, "from" price, Pix discount %, availability (in stock / sold out), delivery estimate (business days min–max), private suppliers list (supplier, link, cost, one marked primary), estimated margin after Stripe fee.
- Settings → "Modelos de negócio": Own store toggle, Affiliates toggle, payment methods (card, boleto, Pix).

**Notifications:** email to the owner on each new paid order (plus the admin highlight). Customer emails: order confirmation (paid), boleto issued (with link/instructions), payment failed/expired, order shipped (tracking), delivered, cancelled/refunded, return request received/resolved.

**Multi-supplier orders (owner decision after review):** status belongs to the **whole order**. Supplier purchase data (supplier, amount paid, supplier order number, purchase link) and **tracking code are per order item**, so one order can show several tracking codes to the customer (carrier + code per item, without supplier names). The customer's "Cancelar pedido" disappears as soon as the purchase of **any** item is registered. Refunds can be partial, by amount (e.g. refund only one item's value).

**Boleto refunds (owner decision):** the app never collects customer bank data or Pix keys. When a boleto order must be refunded, the owner asks the customer for a Pix key by email, pays from their own bank, and records it in the admin as "reembolsado por fora" (amount, date, note). Card refunds go through Stripe from the admin.

**Variants (owner decision):** no variant concept in v1. Each variant (color, capacity, voltage) is a separate product with its own price, availability and suppliers. A variant selector may come later.

**Launch state (my call, flagged to owner):** the migration seeds own store ON and affiliates OFF. Existing products (2 Spain affiliate test items) keep `sale_mode = affiliate` and become invisible; the store starts empty until the owner registers own-mode products. No bulk conversion tool in v1.

**Locales while affiliates are OFF (my call, flagged to owner):** the storefront runs only in pt-BR with market BR. Requests to `/pt-pt`, `/en`, `/es` paths redirect to the pt-BR equivalent, the market cookie is forced to BR, and the language/country switchers are hidden. Cart and checkout enforce market BR on the server. Other locales' translations are not required for own-store copy. When affiliates are turned back ON, the current multi-locale behaviour returns.

## 6. Constraints and facts from research

- Stack: Next.js 16 (App Router, `src/proxy.ts`, server actions, `updateTag`/`unstable_cache`), React 19, Tailwind 4 + shadcn, next-intl (4 locales, localized pathnames in `src/i18n/routing.ts`), Supabase (Postgres + RLS + Auth + Storage), Vitest (unit, db) + Playwright (e2e). Read `node_modules/next/dist/docs/` before using Next APIs (AGENTS.md).
- Visual identity: minimalist black and white; reuse existing store components and admin primitives (`FormSection`, `Field`, `adminAction` with permission + zod + audit).
- Stripe Brazil (researched 2026-11-02):
  - Account with CPF or CNPJ; payouts in BRL to a Brazilian account in the same CPF/CNPJ. Card payouts settle in 30 days; boleto/Pix in ~2 business days.
  - Fees: domestic card 3.99% + R$0.39; international card +2%; boleto R$3.45 per paid boleto; Pix 1.19% (invite-only); dispute R$55.
  - Boleto: R$5.00–R$49,999.99, expires in 3 days by default (configurable), confirms asynchronously (~1 business day), **cannot be refunded through Stripe** (refund must be done outside, e.g. bank transfer/Pix, and recorded manually); requires the customer's CPF/CNPJ.
  - Pix: BRL, min R$0.50, async confirmation, QR expiry configurable (default 4h), refundable within 90 days.
  - Webhooks: confirm on `payment_intent.succeeded` (or Checkout `checkout.session.completed` with paid status + `checkout.session.async_payment_succeeded`); failures `payment_intent.payment_failed` (also Pix expiry), `checkout.session.async_payment_failed`, `checkout.session.expired`; refunds `charge.refunded`, `refund.updated`; disputes `charge.dispute.created/closed`. Verify signature on the raw body, return 2xx fast, store processed event IDs, handle out-of-order and duplicate events, idempotency keys on API writes.
  - Electronics resale is allowed; counterfeits are prohibited.
- Existing data model facts: `products` has no price/stock columns; prices live in `affiliate_links` (store_id NOT NULL, original_url required) and are read by RPCs `product_offers`, `product_market_price`, `search_products`. No orders/cart/address/payment/return tables exist. RLS on every table; permissions seeded in `supabase/seed.sql` and mirrored in `src/lib/auth/permissions.ts` (both must be updated; `tests/db/roles-matrix.test.ts` too). No transactional email provider exists yet.
- Brazilian e-commerce law (Decreto 7.962/2013) requires the seller's name, CNPJ, address and contact on the site; CDC withdrawal (7 days) and warranty (90 days) must be stated. LGPD: CPF/phone/address are personal data; privacy policy must cover them; order data must be retained for fiscal purposes even if a customer deletes their account (anonymise the profile, keep orders).
- Secrets via environment variables only: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, email provider key, owner alert email address. Update `.env.example` and README (README in English).
- Ad tracking added on 2026-11-01 (`marketing-tracker.tsx`) fires on `/go/` clicks; with own store it must also fire AddToCart / InitiateCheckout / Purchase (with value, currency BRL, order id for dedupe) behind marketing consent.

## 7. How the two models coexist (decided requirements)

- Settings: `own_store_enabled` (default ON) and `affiliates_enabled` (default OFF), independent, readable by the storefront.
- Per product: `sale_mode` = own | affiliate. Existing products keep `affiliate`.
- Storefront visibility: an own-mode product is purchasable only while own store is ON; an affiliate-mode product appears (with its "ver na loja" CTA, `/go` links, store info) only while affiliates are ON. When a product's mode is OFF it is hidden from listings, search, sitemap and JSON-LD (direct URL → not found or "indisponível", builder's call).
- Affiliates OFF also hides: footer affiliate notice and links, `/afiliados` and `/como-ganhamos-dinheiro` pages (and sitemap entries), the store filter in catalog, `contactPurchaseNote` wording, campaign CTAs pointing to `/go`. `/go` itself must not redirect for products whose mode is off (keep the route and its logic). Admin affiliate screens remain accessible.
- Nothing in the affiliate tables, adapters, crons, or admin pages is deleted. Cron sync may keep running harmlessly or skip while affiliates are OFF (builder's call).
- Own-store payment data (orders, payments, refunds) lives in its own tables; never reuse `affiliate_conversions`/`affiliate_commissions`.

## 8. Left to the builder

- Stripe integration shape: Payment Element with PaymentIntents or embedded Checkout — either is fine as long as payment happens on NEXTECH pages (no redirect to a stripe.com hosted page) and boleto voucher display works.
- Exact table design (orders, order_items, order_events/history, payments/stripe events, addresses, suppliers, product_suppliers, return_requests, invoices storage), order number format (sequential human number), RPC vs server-action boundaries, RLS policies.
- Where the own-store price lives (new columns/table vs reusing pricing RPCs) and how listings/search/price display read it.
- Cart persistence (suggestion: localStorage for visitors, merged into a DB cart on sign-in, like favorites).
- Address entry details (CEP lookup via a public service such as ViaCEP, saved addresses for reuse).
- Email provider (suggested: Resend) and templates (pt-BR, black and white).
- Boleto expiry window and abandoned-order cleanup.
- Admin permissions naming (e.g. `orders.read`, `orders.write`, `orders.refund`) and role matrix.
- New legal/institutional texts for the own-store model (pt-BR first): terms of sale, returns and warranty, shipping, privacy (CPF/address/phone), "sobre"/"como funciona"; seller identification (MEI name, CNPJ, address, contact) editable in settings (`legal` already has company_name, tax_id, address).
- Tests: unit (pricing/totals, status mapping, webhook idempotency), db (RLS for orders: customers see only their own; admins by permission), e2e (cart → checkout with Stripe test card → webhook → order paid; boleto pending; admin status update). Stripe CLI for local webhooks.

## 9. Owner actions outside the code

- Open the MEI; create the Stripe Brazil account (decide individual vs company with the MEI CNPJ; confirm with Stripe); request Pix access.
- Provide Stripe test keys for development, then live keys.
- Choose a sending domain for emails and create the email provider account.
- Talk to an accountant: MEI invoicing, and Spanish tax residency implications of Brazilian income.
