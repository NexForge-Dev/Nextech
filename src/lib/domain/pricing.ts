import type { MarketCode } from "./markets";

export type PriceDisplayPolicy = "show" | "link_only";
export type SourceKind = "manual" | "import" | "integration";

export type OfferForPricing = {
  id: string;
  market: MarketCode;
  currency: string;
  active: boolean;
  policy: PriceDisplayPolicy;
  priceMinor: number | null;
  priceUpdatedAt: string | null;
  previousPriceMinor: number | null;
  previousVerified: boolean;
  priceSource: SourceKind | null;
  /** True for networks whose terms only allow fresh API prices (Amazon). */
  requiresFreshIntegration: boolean;
  /** Price observations from product_prices, newest first. */
  history: { priceMinor: number; observedAt: string }[];
};

export type PriceSummary =
  | { kind: "price"; fromMinor: number; currency: string; multiple: boolean; previousMinor: number | null; discount: number | null }
  | { kind: "link_only" }
  | { kind: "unavailable"; availableMarkets: MarketCode[] };

const DAY = 86_400_000;
export const PROOF_WINDOW_DAYS = 90;
export const FRESH_INTEGRATION_HOURS = 24;

export function discountPercent(currentMinor: number, previousMinor: number): number {
  if (previousMinor <= 0 || currentMinor >= previousMinor) return 0;
  return Math.round(((previousMinor - currentMinor) / previousMinor) * 100);
}

/** The price shown to visitors, or null when it must not be displayed. */
export function displayPrice(o: OfferForPricing, now: Date): number | null {
  if (!o.active || o.policy === "link_only" || o.priceMinor == null) return null;
  if (o.requiresFreshIntegration) {
    if (o.priceSource !== "integration" || !o.priceUpdatedAt) return null;
    if (now.getTime() - new Date(o.priceUpdatedAt).getTime() > FRESH_INTEGRATION_HOURS * 3_600_000) return null;
  }
  return o.priceMinor;
}

/**
 * A previous price is "proven" only when (a) an earlier observation of this same offer within
 * 90 days was higher than the current price, or (b) the admin verified it with evidence.
 */
export function provenPrevious(o: OfferForPricing, now: Date): number | null {
  const current = displayPrice(o, now);
  if (current == null) return null;
  const cutoff = now.getTime() - PROOF_WINDOW_DAYS * DAY;
  const setAt = o.priceUpdatedAt ? new Date(o.priceUpdatedAt).getTime() : now.getTime();
  const observed = o.history
    .filter((h) => {
      const t = new Date(h.observedAt).getTime();
      return t >= cutoff && t < setAt && h.priceMinor > current;
    })
    .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())[0];
  if (observed) return observed.priceMinor;
  if (o.previousVerified && o.previousPriceMinor != null && o.previousPriceMinor > current) return o.previousPriceMinor;
  return null;
}

function updatedAt(o: OfferForPricing): number {
  return o.priceUpdatedAt ? new Date(o.priceUpdatedAt).getTime() : 0;
}

export function bestOffer(offers: OfferForPricing[], market: MarketCode, now: Date): OfferForPricing | null {
  const inMarket = offers.filter((o) => o.active && o.market === market);
  const priced = inMarket
    .filter((o) => displayPrice(o, now) != null)
    .sort((a, b) => displayPrice(a, now)! - displayPrice(b, now)! || updatedAt(b) - updatedAt(a));
  if (priced[0]) return priced[0];
  return inMarket.find((o) => o.policy === "link_only" || displayPrice(o, now) == null) ?? null;
}

export function priceSummary(offers: OfferForPricing[], market: MarketCode, now: Date): PriceSummary {
  const best = bestOffer(offers, market, now);
  if (!best) {
    const availableMarkets = [...new Set(offers.filter((o) => o.active).map((o) => o.market))].sort();
    return { kind: "unavailable", availableMarkets };
  }
  const price = displayPrice(best, now);
  if (price == null) return { kind: "link_only" };
  const pricedCount = offers.filter((o) => o.active && o.market === market && displayPrice(o, now) != null).length;
  const previousMinor = provenPrevious(best, now);
  return {
    kind: "price",
    fromMinor: price,
    currency: best.currency,
    multiple: pricedCount > 1,
    previousMinor,
    discount: previousMinor != null ? discountPercent(price, previousMinor) || null : null,
  };
}
