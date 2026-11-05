import "server-only";
import { createAnonSupabase } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
import type { MarketCode } from "@/lib/domain/markets";
import { pickTranslation } from "./translations";
import { toCards, type ProductCardData } from "./catalog";
import { baseRow, listAutoDeals, type BannerData } from "./home";
import { mergeDeals } from "@/lib/domain/storefront";

const PRODUCT_FIELDS = "id, slug, rating, rating_count, rating_source, brands(name), product_translations(locale, name)";

const MAX_DEALS = 96;

/** Manual promotions (RLS: active, published, within window, publish_at reached), highlighted first, then products on offer by price. */
export async function listActivePromotions(locale: Locale, market: MarketCode): Promise<{ items: ProductCardData[]; reasons: Map<string, string> }> {
  const [{ data }, autoDeals] = await Promise.all([
    createAnonSupabase()
      .from("promotions")
      .select(`reason, highlighted, starts_at, products(${PRODUCT_FIELDS})`)
      .order("highlighted", { ascending: false })
      .order("starts_at", { ascending: false })
      .limit(MAX_DEALS),
    listAutoDeals(),
  ]);
  const rows = (data ?? []) as unknown as { reason: string | null; products: Parameters<typeof baseRow>[0] | null }[];
  const reasons = new Map<string, string>();
  const manual = [];
  for (const r of rows) {
    if (!r.products) continue;
    manual.push(r.products);
    if (r.reason && !reasons.has(r.products.id)) reasons.set(r.products.id, r.reason);
  }
  const items = await toCards(mergeDeals(manual, autoDeals, MAX_DEALS).map((p) => baseRow(p, locale)), market);
  // the reason is only shown when there is no proven discount to show instead
  for (const item of items) if (item.price.kind === "price" && item.price.discount != null) reasons.delete(item.id);
  return { items, reasons };
}

export type CampaignPage = { id: string; slug: string; title: string; description: string | null; endsAt: string | null; banners: BannerData[]; products: ProductCardData[] };

export async function getCampaign(slug: string, locale: Locale, market: MarketCode): Promise<CampaignPage | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const sb = createAnonSupabase();
  // RLS hides campaigns that are not live; additionally require status 'active'
  const { data: c } = await sb
    .from("campaigns")
    .select(`id, slug, name, status, ends_at, campaign_translations(locale, title, description), campaign_products(sort_order, products(status, ${PRODUCT_FIELDS})), campaign_banners(banners(id, image_path, mobile_image_path, link_url, active, banner_translations(locale, title, subtitle)))`)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!c) return null;
  const t = pickTranslation(c.campaign_translations, locale);
  type Row = { sort_order: number; products: (Parameters<typeof baseRow>[0] & { status: string }) | null };
  const productRows = ((c.campaign_products ?? []) as unknown as Row[])
    .filter((r) => r.products && r.products.status === "published")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => baseRow(r.products!, locale));
  type BRow = { banners: { id: string; image_path: string; mobile_image_path: string | null; link_url: string | null; active: boolean; banner_translations: { locale: string; title: string; subtitle: string | null }[] } | null };
  const banners = ((c.campaign_banners ?? []) as unknown as BRow[])
    .map((r) => r.banners)
    .filter((b): b is NonNullable<BRow["banners"]> => !!b && b.active)
    .map((b) => {
      const bt = pickTranslation(b.banner_translations, locale);
      return { id: b.id, title: bt?.title ?? "", subtitle: bt?.subtitle ?? null, imagePath: b.image_path, mobileImagePath: b.mobile_image_path, linkUrl: b.link_url };
    });
  return { id: c.id, slug: c.slug, title: t?.title ?? c.name, description: t?.description ?? null, endsAt: c.ends_at, banners, products: await toCards(productRows, market) };
}
