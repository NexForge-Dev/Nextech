import "server-only";
import { cache } from "react";
import { createAnonSupabase } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
import type { MarketCode } from "@/lib/domain/markets";
import { pickTranslation } from "./translations";
import { loadOffers, loadSaleInfo, toCards, type OfferRow, type ProductCardData } from "./catalog";
import { getBusinessModels } from "./settings";
import { isModeVisible, type SaleMode } from "@/lib/domain/business-models";
import type { OwnSale } from "@/lib/domain/own-pricing";
import { baseRow } from "./home";

export type Spec = { label: string; value: string };

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  descriptionMd: string | null;
  brand: { name: string; slug: string } | null;
  category: { id: string; slug: string; name: string };
  sku: string | null;
  warranty: string | null;
  rating: { value: number; count: number | null; source: string } | null;
  specs: Spec[];
  images: { path: string; alt: string }[];
  offers: OfferRow[];
  saleMode: SaleMode;
  /** Own-store sale data (null for affiliate products). */
  sale: OwnSale | null;
  tagIds: string[];
  updatedAt: string;
};

function specList(v: unknown): Spec[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is Spec => !!s && typeof s === "object" && typeof (s as Spec).label === "string" && typeof (s as Spec).value === "string")
    .filter((s) => s.label.trim() && s.value.trim());
}

export const getProduct = cache(async (slug: string, locale: Locale): Promise<ProductDetail | null> => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const { data: p } = await createAnonSupabase()
    .from("products")
    .select(
      "id, slug, sku, warranty, rating, rating_count, rating_source, specs, updated_at, brands(name, slug), categories(id, slug, category_translations(locale, name)), product_translations(locale, name, short_description, description_md, specs_i18n), product_images(path, alt, is_main, sort_order), product_tags(tag_id)",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!p || !p.categories) return null;
  const [saleInfo, bm] = await Promise.all([loadSaleInfo([p.id]), getBusinessModels()]);
  const info = saleInfo.get(p.id);
  const saleMode: SaleMode = info?.mode ?? "affiliate";
  if (!isModeVisible(saleMode, bm, info?.sale?.fulfillment)) return null;
  if (saleMode === "own" && !info?.sale) return null;
  const t = pickTranslation(p.product_translations, locale);
  const offers = saleMode === "affiliate" ? ((await loadOffers([p.id])).get(p.id) ?? []) : [];
  const onlyLinkOnly = offers.length > 0 && offers.every((o) => o.policy === "link_only");
  const localizedSpecs = specList(t?.specs_i18n);
  const images = [...(p.product_images ?? [])]
    .sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.sort_order - b.sort_order)
    .map((i) => ({ path: i.path, alt: i.alt ?? "" }));
  return {
    id: p.id,
    slug: p.slug,
    name: t?.name ?? p.slug,
    shortDescription: t?.short_description ?? null,
    descriptionMd: t?.description_md ?? null,
    brand: p.brands ? { name: p.brands.name, slug: p.brands.slug } : null,
    category: { id: p.categories.id, slug: p.categories.slug, name: pickTranslation(p.categories.category_translations, locale)?.name ?? p.categories.slug },
    sku: p.sku,
    warranty: p.warranty,
    rating: p.rating != null && p.rating_source && !onlyLinkOnly ? { value: Number(p.rating), count: p.rating_count, source: p.rating_source } : null,
    specs: localizedSpecs.length ? localizedSpecs : specList(p.specs),
    images,
    offers,
    saleMode,
    sale: saleMode === "own" ? (info?.sale ?? null) : null,
    tagIds: (p.product_tags ?? []).map((x) => x.tag_id),
    updatedAt: p.updated_at,
  };
});

/** Same category first, then products sharing tags. */
export async function getRelated(product: ProductDetail, locale: Locale, market: MarketCode, limit = 8): Promise<ProductCardData[]> {
  const sb = createAnonSupabase();
  const fields = "id, slug, rating, rating_count, rating_source, brands(name), product_translations(locale, name)";
  const { data: sameCat } = await sb.from("products").select(fields).eq("status", "published").eq("category_id", product.category.id).neq("id", product.id).order("published_at", { ascending: false }).limit(limit);
  let rows = (sameCat ?? []) as unknown as Parameters<typeof baseRow>[0][];
  if (rows.length < limit && product.tagIds.length) {
    const { data: tagged } = await sb.from("product_tags").select("product_id").in("tag_id", product.tagIds).limit(50);
    const ids = [...new Set((tagged ?? []).map((r) => r.product_id))].filter((id) => id !== product.id && !rows.some((r) => r.id === id));
    if (ids.length) {
      const { data: more } = await sb.from("products").select(fields).eq("status", "published").in("id", ids.slice(0, limit - rows.length));
      rows = rows.concat((more ?? []) as unknown as Parameters<typeof baseRow>[0][]);
    }
  }
  return toCards(rows.map((r) => baseRow(r, locale)), market);
}
