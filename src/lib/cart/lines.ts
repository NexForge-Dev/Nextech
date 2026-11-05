import { isModeVisible } from "@/lib/domain/business-models";
import type { OwnSale } from "@/lib/domain/own-pricing";
import type { CartItem } from "./local-cart";

export type CartProductRow = {
  id: string;
  slug: string;
  name: string;
  imagePath: string | null;
  saleMode: "own" | "affiliate";
  published: boolean;
  sale: OwnSale | null;
};

export type CartLineProblem = null | "unavailable" | "hidden" | "short";

export type CartLine = {
  productId: string;
  slug: string | null;
  name: string | null;
  imagePath: string | null;
  quantity: number;
  priceMinor: number;
  pixDiscountPct: number;
  lineTotalMinor: number;
  deliveryMaxDays: number | null;
  problem: CartLineProblem;
  /** Units that can still be bought, for products sold from own stock; null when there is no limit. */
  maxQuantity: number | null;
};

/**
 * Cart lines priced from database rows. A line with a problem cannot be checked out. `held`: units
 * this customer already holds in an open order, which stay theirs when they come back to pay.
 */
export function buildCartLines(items: CartItem[], rows: CartProductRow[], bm: { ownStore: boolean }, held: Map<string, number> = new Map()): CartLine[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return items.map((it) => {
    const r = byId.get(it.productId);
    const sellable = !!r && isModeVisible("own", bm, r.sale?.fulfillment) && r.published && r.saleMode === "own" && !!r.sale;
    const sale = sellable ? r!.sale! : null;
    const fromStock = sale?.fulfillment === "stock";
    const mine = fromStock ? (held.get(it.productId) ?? 0) : 0;
    const maxQuantity = fromStock ? (sale!.stockQuantity ?? 0) + mine : null;
    const available = !!sale && (sale.available || (mine > 0 && maxQuantity! > 0));
    const short = maxQuantity != null && it.quantity > maxQuantity;
    const problem: CartLineProblem = !sellable ? "hidden" : !available ? "unavailable" : short ? "short" : null;
    const priceMinor = sale?.priceMinor ?? 0;
    return {
      productId: it.productId,
      slug: r?.slug ?? null,
      name: r?.name ?? null,
      imagePath: r?.imagePath ?? null,
      quantity: it.quantity,
      priceMinor,
      pixDiscountPct: sale?.pixDiscountPct ?? 0,
      lineTotalMinor: priceMinor * it.quantity,
      deliveryMaxDays: sale?.deliveryMaxDays ?? null,
      problem,
      maxQuantity,
    };
  });
}
