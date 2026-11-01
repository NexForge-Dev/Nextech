import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonSupabase } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
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
