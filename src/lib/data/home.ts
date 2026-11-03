import "server-only";
import { createAnonSupabase } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
import type { MarketCode } from "@/lib/domain/markets";
import { getCategories, type NavCategory } from "./taxonomy";
import { pickTranslation } from "./translations";
import { toCards, type ProductCardData } from "./catalog";
import { getBusinessModels } from "./settings";
import { visibleModes } from "@/lib/domain/business-models";

export type FlagshipData = { product: ProductCardData; shortDescription: string | null };

export type BannerData = { id: string; title: string; subtitle: string | null; imagePath: string; mobileImagePath: string | null; linkUrl: string | null };

const PRODUCT_FIELDS = "id, slug, rating, rating_count, rating_source, brands(name), product_translations(locale, name)";

type ProductRow = {
  id: string;
  slug: string;
  rating: number | null;
  rating_count: number | null;
  rating_source: string | null;
  brands: { name: string } | null;
  product_translations: { locale: string; name: string }[];
};

export function baseRow(p: ProductRow, locale: Locale) {
  return {
    id: p.id,
    slug: p.slug,
    name: pickTranslation(p.product_translations, locale)?.name ?? null,
    brand_name: p.brands?.name ?? null,
    rating: p.rating,
    rating_count: p.rating_count,
    rating_source: p.rating_source,
  };
}

export async function getActiveBanners(locale: Locale): Promise<BannerData[]> {
  const { data } = await createAnonSupabase()
    .from("banners")
    .select("id, image_path, mobile_image_path, link_url, sort_order, banner_translations(locale, title, subtitle)")
    .eq("active", true)
    .order("sort_order")
    .limit(5);
  return (data ?? []).map((b) => {
    const t = pickTranslation(b.banner_translations, locale);
    return { id: b.id, title: t?.title ?? "", subtitle: t?.subtitle ?? null, imagePath: b.image_path, mobileImagePath: b.mobile_image_path, linkUrl: b.link_url };
  });
}

/**
 * The flagship picked in the admin. Read per request (not in the 5-minute settings cache) so a change
 * shows on the next visit. Anything that makes it unsellable here (unpublished, deleted, hidden model,
 * another market) returns null and the home falls back to the standard hero.
 */
async function getFlagship(locale: Locale, market: MarketCode): Promise<FlagshipData | null> {
  const sb = createAnonSupabase();
  const { data: setting } = await sb.from("site_settings").select("value").eq("key", "public.flagship_product").maybeSingle();
  const id = typeof setting?.value === "string" ? setting.value : "";
  if (!id) return null;
  const { data } = await sb
    .from("products")
    .select("id, slug, rating, rating_count, rating_source, brands(name), product_translations(locale, name, short_description)")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as ProductRow & { product_translations: { locale: string; name: string; short_description: string | null }[] };
  const [product] = await toCards([baseRow(row, locale)], market);
  if (!product) return null;
  return { product, shortDescription: pickTranslation(row.product_translations, locale)?.short_description ?? null };
}

export async function getHome(locale: Locale, market: MarketCode): Promise<{
  banners: BannerData[];
  flagship: FlagshipData | null;
  categories: NavCategory[];
  featured: ProductCardData[];
  promotions: ProductCardData[];
  popular: ProductCardData[];
  hasAnyProduct: boolean;
}> {
  const sb = createAnonSupabase();
  const modes = visibleModes(await getBusinessModels());
  const [banners, flagship, categories, featuredRes, promoRes, popularRes, anyRes] = await Promise.all([
    getActiveBanners(locale),
    getFlagship(locale, market),
    getCategories(locale),
    sb.from("products").select(PRODUCT_FIELDS).eq("status", "published").eq("featured", true).order("published_at", { ascending: false }).limit(8),
    sb.from("promotions").select(`highlighted, starts_at, products(${PRODUCT_FIELDS})`).order("highlighted", { ascending: false }).order("starts_at", { ascending: false }).limit(8),
    sb.rpc("search_products", { q: "", p_locale: locale, p_market: market, p_sort: "popular", p_limit: 8, p_offset: 0 }),
    sb.from("products").select("id", { count: "exact", head: true }).eq("status", "published").in("sale_mode", modes.length ? modes : ["none"]),
  ]);

  const featuredRows = ((featuredRes.data ?? []) as unknown as ProductRow[]).map((p) => baseRow(p, locale));
  const promoRows = ((promoRes.data ?? []) as unknown as { products: ProductRow | null }[])
    .map((r) => r.products)
    .filter((p): p is ProductRow => !!p)
    .map((p) => baseRow(p, locale));
  const popularRows = (popularRes.data ?? []).filter((r) => Number(r.popularity) > 0);

  // the flagship already fills the top of the page: don't repeat it in the curated grid
  const [featured, promotions, popular] = await Promise.all([
    toCards(featuredRows.filter((p) => p.id !== flagship?.product.id), market),
    toCards(promoRows, market),
    toCards(popularRows, market),
  ]);
  return { banners, flagship, categories, featured, promotions, popular, hasAnyProduct: (anyRes.count ?? 0) > 0 };
}
