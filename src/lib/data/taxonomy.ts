import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonSupabase } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
import { categoryIdsWithProducts, type CategoryProductRow } from "@/lib/domain/storefront";
import { log } from "@/lib/log";
import { getBusinessModels } from "./settings";
import { pickTranslation } from "./translations";

export type NavCategory = { id: string; slug: string; name: string; description: string | null; icon: string; imagePath: string | null };

export const getCategories = unstable_cache(
  async (locale: Locale): Promise<NavCategory[]> => {
    const { data } = await createAnonSupabase()
      .from("categories")
      .select("id, slug, icon, image_path, sort_order, category_translations(locale, name, description)")
      .eq("active", true)
      .order("sort_order");
    return (data ?? []).map((c) => {
      const t = pickTranslation(c.category_translations, locale);
      return { id: c.id, slug: c.slug, name: t?.name ?? c.slug, description: t?.description ?? null, icon: c.icon, imagePath: c.image_path };
    });
  },
  ["categories"],
  { tags: ["catalog", "categories"], revalidate: 600 },
);

const PAGE = 1000;

const getPublishedCategoryRows = unstable_cache(
  async (): Promise<CategoryProductRow[]> => {
    const sb = createAnonSupabase();
    const rows: CategoryProductRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb.from("products").select("category_id, sale_mode, product_sale(fulfillment)").eq("status", "published").order("id").range(from, from + PAGE - 1);
      if (error) throw new Error(`category products: ${error.message}`);
      rows.push(...((data ?? []) as unknown as CategoryProductRow[]));
      if ((data ?? []).length < PAGE) return rows;
    }
  },
  ["published-category-rows"],
  { tags: ["catalog", "categories"], revalidate: 600 },
);

/** Active categories that have something to show: what the storefront menus and filters list. */
export async function getVisibleCategories(locale: Locale): Promise<NavCategory[]> {
  const categories = await getCategories(locale);
  try {
    const [rows, models] = await Promise.all([getPublishedCategoryRows(), getBusinessModels()]);
    const withProducts = categoryIdsWithProducts(rows, models);
    return categories.filter((c) => withProducts.has(c.id));
  } catch (e) {
    // the menu is on every page: a full list beats taking the store down
    log.error("taxonomy.visible_categories_failed", e);
    return categories;
  }
}

export type MarketInfo = { code: string; currency: string };

/** Markets with at least one active store serving them (selector options). */
export const getAvailableMarkets = unstable_cache(
  async (): Promise<MarketInfo[]> => {
    const sb = createAnonSupabase();
    const [{ data: markets }, { data: stores }] = await Promise.all([
      sb.from("markets").select("code, default_currency, active").eq("active", true),
      sb.from("stores").select("markets").eq("active", true),
    ]);
    const served = new Set((stores ?? []).flatMap((s) => s.markets ?? []));
    return (markets ?? []).filter((m) => served.has(m.code)).map((m) => ({ code: m.code, currency: m.default_currency }));
  },
  ["available-markets"],
  { tags: ["catalog", "stores"], revalidate: 600 },
);
