import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonSupabase } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
import type { MarketCode } from "@/lib/domain/markets";
import { priceSummary, type OfferForPricing, type PriceSummary, type SourceKind } from "@/lib/domain/pricing";
import { PAGE_SIZE, type CatalogFilters } from "@/lib/domain/filters";
import { isModeVisible, type SaleMode } from "@/lib/domain/business-models";
import { ownPriceSummary, ownSaleNow, promoFromRow, type OwnSale } from "@/lib/domain/own-pricing";
import { getBusinessModels } from "./settings";

export type OfferRow = OfferForPricing & {
  productId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  storeLogo: string | null;
  networkId: string | null;
  networkAdapter: string | null;
};

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  mainImage: { path: string; alt: string } | null;
  price: PriceSummary;
  rating: { value: number; count: number | null; source: string } | null;
  saleMode: SaleMode;
  available: boolean;
  promoEndsAt?: string | null;
};

type SaleInfo = { mode: SaleMode; sale: OwnSale | null };

/** Sale mode and own-store sale data for a set of products. */
export async function loadSaleInfo(productIds: string[], now = new Date()): Promise<Map<string, SaleInfo>> {
  const map = new Map<string, SaleInfo>();
  if (!productIds.length) return map;
  const { data, error } = await createAnonSupabase()
    .from("products")
    .select("id, sale_mode, product_sale(price_minor, compare_at_minor, pix_discount_pct, available, delivery_min_days, delivery_max_days, fulfillment, stock_quantity, promo_price_minor, promo_starts_at, promo_ends_at)")
    .in("id", productIds.slice(0, 200));
  if (error) throw new Error(`sale info: ${error.message}`);
  // units in expired holds are for sale: checkout releases them, after asking Stripe, when someone buys
  const soldOut = (data ?? []).filter((r) => r.product_sale?.fulfillment === "stock" && !r.product_sale.stock_quantity).map((r) => r.id);
  const expired = new Map<string, number>();
  if (soldOut.length) {
    const { data: holds } = await createAnonSupabase().rpc("expired_hold_units", { p_ids: soldOut });
    for (const h of holds ?? []) expired.set(h.product_id, Number(h.units));
  }
  for (const r of data ?? []) {
    const s = r.product_sale;
    const stock = s ? (s.stock_quantity ?? 0) + (expired.get(r.id) ?? 0) : 0;
    map.set(r.id, {
      mode: r.sale_mode === "own" ? "own" : "affiliate",
      sale: s
        ? {
            ...ownSaleNow({ priceMinor: Number(s.price_minor), compareAtMinor: s.compare_at_minor == null ? null : Number(s.compare_at_minor), promo: promoFromRow(s) }, now),
            pixDiscountPct: Number(s.pix_discount_pct),
            // own stock sells out by itself when it reaches zero
            available: s.available && (s.fulfillment !== "stock" || stock > 0),
            fulfillment: s.fulfillment === "stock" ? "stock" : "dropship",
            stockQuantity: s.fulfillment === "stock" ? stock : s.stock_quantity,
            deliveryMinDays: s.delivery_min_days,
            deliveryMaxDays: s.delivery_max_days,
          }
        : null,
    });
  }
  return map;
}

/** Offers (with effective price policy) for a set of products, grouped by product id. */
export async function loadOffers(productIds: string[]): Promise<Map<string, OfferRow[]>> {
  const map = new Map<string, OfferRow[]>();
  if (productIds.length === 0) return map;
  const { data, error } = await createAnonSupabase().rpc("product_offers", { p_ids: productIds.slice(0, 200) });
  if (error) throw new Error(`product_offers: ${error.message}`);
  for (const r of data ?? []) {
    const offer: OfferRow = {
      id: r.id,
      productId: r.product_id,
      storeId: r.store_id,
      storeSlug: r.store_slug,
      storeName: r.store_name,
      storeLogo: r.store_logo,
      networkId: r.network_id,
      networkAdapter: r.network_adapter,
      market: r.market,
      currency: r.currency,
      active: true,
      policy: r.policy === "link_only" ? "link_only" : "show",
      priceMinor: r.price_minor,
      priceUpdatedAt: r.price_updated_at,
      previousPriceMinor: r.previous_price_minor,
      previousVerified: r.previous_verified,
      priceSource: (r.price_source as SourceKind | null) ?? null,
      requiresFreshIntegration: r.requires_fresh,
      history: Array.isArray(r.history) ? (r.history as { priceMinor: number; observedAt: string }[]) : [],
    };
    const list = map.get(r.product_id) ?? [];
    list.push(offer);
    map.set(r.product_id, list);
  }
  return map;
}

async function loadMainImages(productIds: string[]): Promise<Map<string, { path: string; alt: string }>> {
  const map = new Map<string, { path: string; alt: string }>();
  if (!productIds.length) return map;
  const { data } = await createAnonSupabase()
    .from("product_images")
    .select("product_id, path, alt, is_main, sort_order")
    .in("product_id", productIds)
    .order("is_main", { ascending: false })
    .order("sort_order");
  for (const img of data ?? []) if (!map.has(img.product_id)) map.set(img.product_id, { path: img.path, alt: img.alt ?? "" });
  return map;
}

type BaseRow = {
  id: string;
  slug: string;
  name: string | null;
  brand_name: string | null;
  rating: number | null;
  rating_count: number | null;
  rating_source: string | null;
};

/**
 * Turn base product rows into cards: offers → honest price summary, main image, sourced rating.
 * Products whose business model is switched off (or own products outside Brazil) are dropped here,
 * so every listing (home, catalog, favourites, history, related) honours the switches.
 */
export async function toCards(rows: BaseRow[], market: MarketCode, now = new Date()): Promise<ProductCardData[]> {
  const ids = rows.map((r) => r.id);
  const [offers, images, saleInfo, bm] = await Promise.all([loadOffers(ids), loadMainImages(ids), loadSaleInfo(ids, now), getBusinessModels()]);
  return rows.flatMap((r): ProductCardData[] => {
    const info = saleInfo.get(r.id) ?? { mode: "affiliate" as const, sale: null };
    if (!isModeVisible(info.mode, bm, info.sale?.fulfillment)) return [];
    if (info.mode === "own") {
      if (!info.sale || market !== "BR") return [];
      const rating = r.rating != null && r.rating_source ? { value: Number(r.rating), count: r.rating_count, source: r.rating_source } : null;
      return [{ id: r.id, slug: r.slug, name: r.name ?? r.slug, brand: r.brand_name, mainImage: images.get(r.id) ?? null, price: ownPriceSummary(info.sale), rating, saleMode: "own", available: info.sale.available, promoEndsAt: info.sale.promoEndsAt ?? null }];
    }
    const productOffers = offers.get(r.id) ?? [];
    const price = priceSummary(productOffers, market, now);
    // ratings copied from a link_only network (Amazon) must not be shown either
    const onlyLinkOnly = productOffers.length > 0 && productOffers.every((o) => o.policy === "link_only");
    const rating = r.rating != null && r.rating_source && !onlyLinkOnly ? { value: Number(r.rating), count: r.rating_count, source: r.rating_source } : null;
    return [{ id: r.id, slug: r.slug, name: r.name ?? r.slug, brand: r.brand_name, mainImage: images.get(r.id) ?? null, price, rating, saleMode: "affiliate", available: true }];
  });
}

export async function listProducts(f: CatalogFilters, locale: Locale, market: MarketCode): Promise<{ items: ProductCardData[]; total: number }> {
  const { data, error } = await createAnonSupabase().rpc("search_products", {
    q: f.q ?? "",
    p_locale: locale,
    p_market: market,
    p_category: f.category,
    p_brand: f.brand,
    p_store: f.store,
    p_min_minor: f.min,
    p_max_minor: f.max,
    p_min_rating: f.rating,
    p_proven_discount: f.discount ?? false,
    p_sort: f.sort,
    p_limit: PAGE_SIZE,
    p_offset: (f.page - 1) * PAGE_SIZE,
  });
  if (error) throw new Error(`search_products: ${error.message}`);
  const rows = data ?? [];
  const items = await toCards(rows, market);
  return { items, total: rows.length ? Number(rows[0].total_count) : 0 };
}

export type FacetData = {
  brands: { slug: string; name: string }[];
  stores: { slug: string; name: string }[];
};

export const getFacets = unstable_cache(
  async (): Promise<FacetData> => {
    const sb = createAnonSupabase();
    const [{ data: brands }, { data: stores }] = await Promise.all([
      sb.from("brands").select("slug, name").eq("active", true).order("name").limit(200),
      sb.from("stores").select("slug, name").eq("active", true).order("name").limit(100),
    ]);
    return { brands: brands ?? [], stores: stores ?? [] };
  },
  ["facets"],
  { tags: ["catalog"], revalidate: 600 },
);

export async function suggest(q: string, locale: Locale) {
  const { data } = await createAnonSupabase().rpc("suggest", { q: q.slice(0, 100), p_locale: locale, p_limit: 6 });
  return data ?? [];
}
