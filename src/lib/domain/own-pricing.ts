import type { PriceSummary } from "./pricing";
/** Own-store (loja própria) money rules. All amounts are integer centavos (BRL minor units). */

export type OwnSale = {
  priceMinor: number;
  compareAtMinor: number | null;
  pixDiscountPct: number;
  available: boolean;
  deliveryMinDays: number;
  deliveryMaxDays: number;
  fulfillment?: "stock" | "dropship";
  stockQuantity?: number | null;
  /** Set only while a timed promotion is running: when it ends, for the countdown. */
  promoEndsAt?: string | null;
};

export type OwnPromo = { priceMinor: number; startsAt: string; endsAt: string };

type PromoColumns = { promo_price_minor?: number | null; promo_starts_at?: string | null; promo_ends_at?: string | null };

export function promoFromRow(r: PromoColumns): OwnPromo | null {
  if (r.promo_price_minor == null || !r.promo_starts_at || !r.promo_ends_at) return null;
  return { priceMinor: Number(r.promo_price_minor), startsAt: r.promo_starts_at, endsAt: r.promo_ends_at };
}

/**
 * What the product costs right now. While a promotion runs, the regular price is the one shown crossed
 * out; before and after it nothing changes. Mirrors the SQL `promo_running`.
 */
export function ownSaleNow(base: { priceMinor: number; compareAtMinor: number | null; promo: OwnPromo | null }, now: Date) {
  const { priceMinor, compareAtMinor, promo } = base;
  const t = now.getTime();
  if (promo && promo.priceMinor < priceMinor && t >= Date.parse(promo.startsAt) && t < Date.parse(promo.endsAt)) {
    return { priceMinor: promo.priceMinor, compareAtMinor: priceMinor, promoEndsAt: promo.endsAt };
  }
  return { priceMinor, compareAtMinor, promoEndsAt: null };
}

/** "02:13:45", with the days in front when there are any: "1d 02:13:45". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = Math.floor(s / 86_400);
  const clock = `${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  return days ? `${days}d ${clock}` : clock;
}

export type PaymentMethod = "card" | "boleto" | "pix";
export const PAYMENT_METHODS: readonly PaymentMethod[] = ["card", "boleto", "pix"];

/** Stripe Brazil list prices, used only for estimates (the real fee comes from the balance transaction). */
export const STRIPE_FEES = {
  card: { bps: 399, fixedMinor: 39 },
  boleto: { bps: 0, fixedMinor: 345 },
  pix: { bps: 119, fixedMinor: 0 },
} as const satisfies Record<PaymentMethod, { bps: number; fixedMinor: number }>;

export const BOLETO_MIN_MINOR = 500;
export const BOLETO_MAX_MINOR = 4_999_999;
export const PIX_MIN_MINOR = 50;

/**
 * Pix price, rounded half up to the centavo. Integer math (pct in hundredths) so the SQL
 * `create_order_from_cart` can mirror it exactly: floor((price * (10000 - pct*100) + 5000) / 10000).
 */
export function pixPriceMinor(priceMinor: number, pct: number): number {
  const bp = Math.round(pct * 100);
  if (bp <= 0) return priceMinor;
  return Math.floor((priceMinor * (10_000 - bp) + 5_000) / 10_000);
}

export function ownDiscountPct(sale: Pick<OwnSale, "priceMinor" | "compareAtMinor">): number | null {
  const { priceMinor, compareAtMinor } = sale;
  if (compareAtMinor == null || compareAtMinor <= priceMinor) return null;
  return Math.round(((compareAtMinor - priceMinor) / compareAtMinor) * 100) || null;
}

export function estimateStripeFeeMinor(amountMinor: number, method: PaymentMethod): number {
  const f = STRIPE_FEES[method];
  return Math.ceil((amountMinor * f.bps) / 10_000) + f.fixedMinor;
}

export function estimateMarginMinor(i: { revenueMinor: number; feeMinor: number; costMinor: number }): { marginMinor: number; marginPct: number | null } {
  const marginMinor = i.revenueMinor - i.feeMinor - i.costMinor;
  return { marginMinor, marginPct: i.revenueMinor > 0 ? Math.round((marginMinor / i.revenueMinor) * 100) : null };
}

export type TotalsLine = { priceMinor: number; quantity: number; pixDiscountPct: number };

export function cartTotals(lines: TotalsLine[], method: PaymentMethod): { subtotalMinor: number; discountMinor: number; totalMinor: number } {
  let subtotalMinor = 0;
  let discountMinor = 0;
  for (const l of lines) {
    subtotalMinor += l.priceMinor * l.quantity;
    if (method === "pix") discountMinor += (l.priceMinor - pixPriceMinor(l.priceMinor, l.pixDiscountPct)) * l.quantity;
  }
  return { subtotalMinor, discountMinor, totalMinor: subtotalMinor - discountMinor };
}

/** Card/list price summary for an own product, in the same shape the storefront uses for affiliate offers. */
export function ownPriceSummary(sale: Pick<OwnSale, "priceMinor" | "compareAtMinor">): Extract<PriceSummary, { kind: "price" }> {
  const discount = ownDiscountPct(sale);
  return { kind: "price", fromMinor: sale.priceMinor, currency: "BRL", multiple: false, previousMinor: discount ? sale.compareAtMinor : null, discount };
}
