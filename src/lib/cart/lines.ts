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

export type CartLineProblem = null | "unavailable" | "hidden";

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
};

/** Cart lines priced from database rows. A line with a problem cannot be checked out. */
export function buildCartLines(items: CartItem[], rows: CartProductRow[], bm: { ownStore: boolean }): CartLine[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return items.map((it) => {
    const r = byId.get(it.productId);
    const sellable = !!r && isModeVisible("own", bm, r.sale?.fulfillment) && r.published && r.saleMode === "own" && !!r.sale;
    const sale = sellable ? r!.sale! : null;
    const problem: CartLineProblem = !sellable ? "hidden" : sale!.available ? null : "unavailable";
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
    };
  });
}
