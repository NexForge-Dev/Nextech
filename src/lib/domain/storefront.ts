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
  available: boolean;
  fulfillment: string;
  stock_quantity: number | null;
  products: P | null;
};

const discountShare = (r: DealRow<unknown>) => 1 - Number(r.price_minor) / Number(r.compare_at_minor);

/** A "de" price above the current price puts a buyable product on offer, biggest discount first. */
export function autoDealProducts<P>(rows: DealRow<P>[], models: Switches): P[] {
  return rows
    .filter((r) => r.products && r.compare_at_minor != null && Number(r.compare_at_minor) > Number(r.price_minor))
    .filter((r) => r.available && (r.fulfillment !== "stock" || (r.stock_quantity ?? 0) > 0))
    .filter((r) => isModeVisible("own", models, r.fulfillment === "stock" ? "stock" : "dropship"))
    .sort((a, b) => discountShare(b) - discountShare(a))
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
