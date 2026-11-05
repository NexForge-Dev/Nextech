import { ownSaleNow, promoFromRow } from "./own-pricing";
import { isModeVisible, type BusinessModels, type Fulfillment, type SaleMode } from "./business-models";

export type CategoryProductRow = { category_id: string; sale_mode: string; product_sale: { fulfillment: string } | null };

type Switches = Pick<BusinessModels, "ownStore" | "ownStock" | "dropshipping" | "affiliates">;

/** Categories the storefront can list: those with at least one product customers can actually see. */
export function categoryIdsWithProducts(rows: CategoryProductRow[], models: Switches): Set<string> {
  const ids = new Set<string>();
  for (const r of rows) {
    const mode: SaleMode = r.sale_mode === "own" ? "own" : "affiliate";
    if (mode === "own" && !r.product_sale) continue;
    const fulfillment: Fulfillment | null = r.product_sale ? (r.product_sale.fulfillment === "stock" ? "stock" : "dropship") : null;
    if (isModeVisible(mode, models, fulfillment)) ids.add(r.category_id);
  }
  return ids;
}

export type DealRow<P> = {
  price_minor: number;
  compare_at_minor: number | null;
  promo_price_minor?: number | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
  available: boolean;
  fulfillment: string;
  stock_quantity: number | null;
  products: P | null;
};

/** Share of the "de" price taken off right now, with any running promotion applied; 0 when not on offer. */
function discountShare(r: DealRow<unknown>, now: Date): number {
  const { priceMinor, compareAtMinor } = ownSaleNow({ priceMinor: Number(r.price_minor), compareAtMinor: r.compare_at_minor == null ? null : Number(r.compare_at_minor), promo: promoFromRow(r) }, now);
  return compareAtMinor != null && compareAtMinor > priceMinor ? 1 - priceMinor / compareAtMinor : 0;
}

/** A "de" price above the current price, or a running promotion, puts a buyable product on offer, biggest discount first. */
export function autoDealProducts<P>(rows: DealRow<P>[], models: Switches, now = new Date()): P[] {
  return rows
    .filter((r) => r.products && discountShare(r, now) > 0)
    .filter((r) => r.available && (r.fulfillment !== "stock" || (r.stock_quantity ?? 0) > 0))
    .filter((r) => isModeVisible("own", models, r.fulfillment === "stock" ? "stock" : "dropship"))
    .sort((a, b) => discountShare(b, now) - discountShare(a, now))
    .map((r) => r.products as P);
}

/** Manual offers keep their place at the top; automatic ones fill in without repeating a product. */
export function mergeDeals<P extends { id: string }>(manual: P[], auto: P[], limit: number): P[] {
  const seen = new Set<string>();
  const merged: P[] = [];
  for (const p of [...manual, ...auto]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
  }
  return merged.slice(0, limit);
}
