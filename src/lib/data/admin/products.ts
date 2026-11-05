import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { minorDigits } from "@/lib/domain/money";
import type { ProductFormValue } from "@/components/admin/product-form";
import { getMarketOptions } from "./options";

export const EMPTY_SALE = { price: "", compareAt: "", pixDiscountPct: "0", available: true, deliveryMinDays: 3, deliveryMaxDays: 7, fulfillment: "dropship" as "stock" | "dropship", stock: "" };

export async function getProductFormOptions() {
  const sb = await createServerSupabase();
  const [cats, brands, stores, markets, suppliers] = await Promise.all([
    sb.from("categories").select("id, slug, category_translations(locale, name)").order("sort_order"),
    sb.from("brands").select("id, name").order("name"),
    sb.from("stores").select("id, name, network_id, markets").order("name"),
    getMarketOptions(),
    sb.from("suppliers").select("id, name").eq("active", true).order("name"),
  ]);
  return {
    categories: (cats.data ?? []).map((c) => ({ id: c.id, name: c.category_translations.find((t) => t.locale === "pt-BR")?.name ?? c.slug })),
    brands: brands.data ?? [],
    stores: (stores.data ?? []).map((s) => ({ id: s.id, name: s.name, networkId: s.network_id, markets: s.markets })),
    markets: markets.map((m) => ({ code: m.code, name: m.name, currency: m.currency })),
    suppliers: suppliers.data ?? [],
  };
}

/** Categories, brands and active suppliers as the JSON import names them. */
export async function getProductJsonCatalog() {
  const sb = await createServerSupabase();
  const [cats, brands, suppliers] = await Promise.all([
    sb.from("categories").select("id, slug, category_translations(locale, name)").order("sort_order"),
    sb.from("brands").select("id, slug, name").order("name"),
    sb.from("suppliers").select("id, name").eq("active", true).order("name"),
  ]);
  return {
    categories: (cats.data ?? []).map((c) => ({ id: c.id, slug: c.slug, name: c.category_translations.find((t) => t.locale === "pt-BR")?.name ?? c.slug })),
    brands: brands.data ?? [],
    suppliers: suppliers.data ?? [],
  };
}

function money(minor: number | null, currency: string): string {
  if (minor == null) return "";
  const d = minorDigits(currency);
  return (minor / 10 ** d).toFixed(d).replace(".", ",");
}

export async function getProductForEdit(id: string): Promise<ProductFormValue | null> {
  const sb = await createServerSupabase();
  const { data: p } = await sb
    .from("products")
    .select("id, slug, brand_id, category_id, status, featured, sku, external_id, warranty, rating, rating_count, rating_source, specs, product_translations(locale, name, short_description, description_md, specs_i18n), product_images(path, alt, is_main, sort_order), product_tags(tags(slug)), affiliate_links(id, store_id, network_id, market, currency, original_url, affiliate_url, external_id, price_minor, price_updated_at, previous_price_minor, previous_verified, previous_evidence, active, created_at), sale_mode, product_sale(price_minor, compare_at_minor, pix_discount_pct, available, delivery_min_days, delivery_max_days, fulfillment, stock_quantity), product_suppliers(supplier_id, url, cost_minor, is_primary, notes, created_at)")
    .eq("id", id)
    .maybeSingle();
  if (!p) return null;
  const translations: ProductFormValue["translations"] = {};
  for (const t of p.product_translations) {
    translations[t.locale as keyof typeof translations] = {
      name: t.name,
      shortDescription: t.short_description ?? "",
      descriptionMd: t.description_md ?? "",
      specs: Array.isArray(t.specs_i18n) ? (t.specs_i18n as { label: string; value: string }[]) : [],
    };
  }
  return {
    id: p.id,
    slug: p.slug,
    brandId: p.brand_id,
    categoryId: p.category_id,
    tags: p.product_tags.map((x) => x.tags?.slug).filter((x): x is string => !!x),
    status: p.status as ProductFormValue["status"],
    featured: p.featured,
    sku: p.sku ?? "",
    externalId: p.external_id ?? "",
    warranty: p.warranty ?? "",
    rating: p.rating != null ? String(p.rating).replace(".", ",") : "",
    ratingCount: p.rating_count != null ? String(p.rating_count) : "",
    ratingSource: p.rating_source ?? "",
    specs: Array.isArray(p.specs) ? (p.specs as { label: string; value: string }[]) : [],
    translations,
    images: [...p.product_images].sort((a, b) => a.sort_order - b.sort_order).map((i) => ({ path: i.path, alt: i.alt ?? "", isMain: i.is_main })),
    offers: [...p.affiliate_links]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((l) => ({
        id: l.id,
        storeId: l.store_id,
        networkId: l.network_id,
        market: l.market,
        currency: l.currency,
        originalUrl: l.original_url,
        affiliateUrl: l.affiliate_url ?? "",
        price: money(l.price_minor, l.currency),
        previousPrice: money(l.previous_price_minor, l.currency),
        previousVerified: l.previous_verified,
        previousEvidence: l.previous_evidence ?? "",
        externalId: l.external_id ?? "",
        active: l.active,
        priceUpdatedAt: l.price_updated_at,
      })),
    saleMode: p.sale_mode === "own" ? "own" : "affiliate",
    sale: p.product_sale
      ? {
          price: money(p.product_sale.price_minor, "BRL"),
          compareAt: money(p.product_sale.compare_at_minor, "BRL"),
          pixDiscountPct: String(p.product_sale.pix_discount_pct).replace(".", ","),
          available: p.product_sale.available,
          deliveryMinDays: p.product_sale.delivery_min_days,
          deliveryMaxDays: p.product_sale.delivery_max_days,
          fulfillment: p.product_sale.fulfillment === "stock" ? ("stock" as const) : ("dropship" as const),
          stock: p.product_sale.stock_quantity == null ? "" : String(p.product_sale.stock_quantity),
        }
      : EMPTY_SALE,
    suppliers: [...p.product_suppliers]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.created_at.localeCompare(b.created_at))
      .map((x) => ({ supplierId: x.supplier_id, url: x.url ?? "", cost: money(x.cost_minor, "BRL"), isPrimary: x.is_primary, notes: x.notes ?? "" })),
  };
}

/** Click counts in the last 30 days (bots excluded) for a set of products. */
export async function clicks30d(productIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!productIds.length) return map;
  const sb = await createServerSupabase();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await sb.from("affiliate_clicks").select("product_id").in("product_id", productIds).eq("is_bot", false).gte("occurred_at", since).limit(100000);
  for (const r of data ?? []) if (r.product_id) map.set(r.product_id, (map.get(r.product_id) ?? 0) + 1);
  return map;
}
