type Row = { slug: string; updated_at: string | null; sale_mode: string; product_sale: unknown };

/** Products the storefront can actually show: an own-store product needs its sale data (price). */
export function listableProducts<T extends Row>(rows: T[]): T[] {
  return rows.filter((r) => r.sale_mode !== "own" || r.product_sale != null);
}
