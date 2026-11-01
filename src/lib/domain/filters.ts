export const SORTS = ["relevance", "price_asc", "price_desc", "popular", "recent", "discount"] as const;
export type Sort = (typeof SORTS)[number];

export type CatalogFilters = {
  q?: string;
  category?: string;
  brand?: string;
  store?: string;
  /** minor units */
  min?: number;
  /** minor units */
  max?: number;
  rating?: number;
  discount?: boolean;
  sort: Sort;
  page: number;
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const PAGE_SIZE = 24;

function slug(v: string | null): string | undefined {
  return v && v.length <= 120 && SLUG.test(v) ? v : undefined;
}

function money(v: string | null, digits: number): number | undefined {
  if (!v) return undefined;
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1e9) return undefined;
  return Math.round(n * 10 ** digits);
}

/** Parse catalogue search params. Prices in the URL are in major units (e.g. "199.90"). */
export function parseFilters(sp: URLSearchParams, currencyDigits = 2): CatalogFilters {
  const q = sp.get("q")?.trim().slice(0, 100) || undefined;
  const rawSort = sp.get("sort") as Sort | null;
  let sort: Sort = q ? "relevance" : "recent";
  if (rawSort && (SORTS as readonly string[]).includes(rawSort) && (rawSort !== "relevance" || q)) sort = rawSort;
  const rating = Number(sp.get("rating"));
  const page = Math.floor(Number(sp.get("page")));
  const f: CatalogFilters = { sort, page: Number.isFinite(page) && page >= 1 ? Math.min(page, 1000) : 1 };
  if (q) f.q = q;
  const category = slug(sp.get("category"));
  if (category) f.category = category;
  const brand = slug(sp.get("brand"));
  if (brand) f.brand = brand;
  const store = slug(sp.get("store"));
  if (store) f.store = store;
  const min = money(sp.get("min"), currencyDigits);
  if (min !== undefined) f.min = min;
  const max = money(sp.get("max"), currencyDigits);
  if (max !== undefined) f.max = max;
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) f.rating = rating;
  if (sp.get("discount") === "1") f.discount = true;
  return f;
}

/** Stable query string (fixed key order, defaults omitted). */
export function serializeFilters(f: CatalogFilters, currencyDigits = 2): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.category) sp.set("category", f.category);
  if (f.brand) sp.set("brand", f.brand);
  if (f.store) sp.set("store", f.store);
  if (f.min !== undefined) sp.set("min", String(f.min / 10 ** currencyDigits));
  if (f.max !== undefined) sp.set("max", String(f.max / 10 ** currencyDigits));
  if (f.rating) sp.set("rating", String(f.rating));
  if (f.discount) sp.set("discount", "1");
  const defaultSort: Sort = f.q ? "relevance" : "recent";
  if (f.sort !== defaultSort) sp.set("sort", f.sort);
  if (f.page > 1) sp.set("page", String(f.page));
  return sp.toString();
}

export function filtersToRecord(f: CatalogFilters, currencyDigits = 2): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(serializeFilters(f, currencyDigits)));
}
