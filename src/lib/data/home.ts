import "server-only";
import { createAnonSupabase } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
import type { MarketCode } from "@/lib/domain/markets";
import { getVisibleCategories, type NavCategory } from "./taxonomy";
import { pickTranslation } from "./translations";
import { toCards, type ProductCardData } from "./catalog";
import { getBusinessModels } from "./settings";
import { log } from "@/lib/log";
import { visibleModes } from "@/lib/domain/business-models";
import { flagshipCandidates, flagshipLineup, MAX_FLAGSHIPS } from "@/lib/domain/flagship";
import { autoDealProducts, mergeDeals, type DealRow } from "@/lib/domain/storefront";

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

const AUTO_DEALS_SCANNED = 200;

/** Published products on offer by price alone, limited to the sale modes switched on. */
export async function listAutoDeals(): Promise<ProductRow[]> {
  const [{ data, error }, models] = await Promise.all([
    createAnonSupabase()
      .from("product_sale")
      .select(`price_minor, compare_at_minor, available, fulfillment, stock_quantity, products(${PRODUCT_FIELDS})`)
      .not("compare_at_minor", "is", null)
      .limit(AUTO_DEALS_SCANNED),
    getBusinessModels(),
  ]);
  if (error) {
    log.error("deals.auto_failed", new Error(error.message));
    return [];
  }
  return autoDealProducts((data ?? []) as unknown as DealRow<ProductRow>[], models);
}

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

const FLAGSHIP_FIELDS = "id, slug, featured, rating, rating_count, rating_source, brands(name), product_translations(locale, name, short_description)";

type FlagshipRow = Omit<ProductRow, "product_translations"> & {
  featured: boolean;
  product_translations: { locale: string; name: string; short_description: string | null }[];
};

/**
 * The products at the top of the home: every highlighted one, with the pick from Admin → Produtos in
 * front. With nothing highlighted, the most recent published product takes the spot alone. Read per
 * request, so a change shows on the next visit, and only empty when nothing can be sold here.
 */
async function getFlagships(locale: Locale, market: MarketCode): Promise<FlagshipData[]> {
  const sb = createAnonSupabase();
  const [{ data: setting }, { data: recent }] = await Promise.all([
    sb.from("site_settings").select("value").eq("key", "public.flagship_product").maybeSingle(),
    sb.from("products").select(FLAGSHIP_FIELDS).eq("status", "published").order("featured", { ascending: false }).order("published_at", { ascending: false }).limit(24),
  ]);
  const pickedId = typeof setting?.value === "string" ? setting.value : "";
  let rows = (recent ?? []) as unknown as FlagshipRow[];
  if (pickedId && !rows.some((r) => r.id === pickedId)) {
    const { data: picked } = await sb.from("products").select(FLAGSHIP_FIELDS).eq("id", pickedId).eq("status", "published").maybeSingle();
    if (picked) rows = [picked as unknown as FlagshipRow, ...rows];
  }
  const toFlagshipCards = (list: FlagshipRow[]) => toCards(list.map((r) => baseRow(r, locale)), market);
  let cards = await toFlagshipCards(flagshipLineup(rows, pickedId));
  if (!cards.length) cards = (await toFlagshipCards(flagshipCandidates(rows, pickedId))).slice(0, 1);
  return cards.slice(0, MAX_FLAGSHIPS).map((product) => ({
    product,
    shortDescription: pickTranslation(rows.find((r) => r.id === product.id)?.product_translations, locale)?.short_description ?? null,
  }));
}

export async function getHome(locale: Locale, market: MarketCode): Promise<{
  banners: BannerData[];
  flagships: FlagshipData[];
  categories: NavCategory[];
  featured: ProductCardData[];
  promotions: ProductCardData[];
  popular: ProductCardData[];
  hasAnyProduct: boolean;
}> {
  const sb = createAnonSupabase();
  const modes = visibleModes(await getBusinessModels());
  const [banners, flagships, categories, featuredRes, promoRes, popularRes, anyRes, autoDeals] = await Promise.all([
    getActiveBanners(locale),
    getFlagships(locale, market),
    getVisibleCategories(locale),
    sb.from("products").select(PRODUCT_FIELDS).eq("status", "published").eq("featured", true).order("published_at", { ascending: false }).limit(8),
    sb.from("promotions").select(`highlighted, starts_at, products(${PRODUCT_FIELDS})`).order("highlighted", { ascending: false }).order("starts_at", { ascending: false }).limit(8),
    sb.rpc("search_products", { q: "", p_locale: locale, p_market: market, p_sort: "popular", p_limit: 8, p_offset: 0 }),
    sb.from("products").select("id", { count: "exact", head: true }).eq("status", "published").in("sale_mode", modes.length ? modes : ["none"]),
    listAutoDeals(),
  ]);

  const featuredRows = ((featuredRes.data ?? []) as unknown as ProductRow[]).map((p) => baseRow(p, locale));
  const manualDeals = ((promoRes.data ?? []) as unknown as { products: ProductRow | null }[]).map((r) => r.products).filter((p): p is ProductRow => !!p);
  const promoRows = mergeDeals(manualDeals, autoDeals, 8).map((p) => baseRow(p, locale));
  const popularRows = (popularRes.data ?? []).filter((r) => Number(r.popularity) > 0);

  // whatever fills the top of the page isn't repeated in the curated grid
  const onTop = new Set(flagships.map((f) => f.product.id));
  const [featured, promotions, popular] = await Promise.all([
    toCards(featuredRows.filter((p) => !onTop.has(p.id)), market),
    toCards(promoRows, market),
    toCards(popularRows, market),
  ]);
  return { banners, flagships, categories, featured, promotions, popular, hasAnyProduct: (anyRes.count ?? 0) > 0 };
}
