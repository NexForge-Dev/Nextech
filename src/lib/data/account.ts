import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAnonSupabase } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
import type { MarketCode } from "@/lib/domain/markets";
import { toCards, type ProductCardData } from "./catalog";
import { baseRow } from "./home";

const PRODUCT_FIELDS = "id, slug, status, rating, rating_count, rating_source, brands(name), product_translations(locale, name)";
type Row = Parameters<typeof baseRow>[0] & { status: string };

export type Profile = {
  fullName: string | null;
  preferredLocale: string | null;
  preferredMarket: string | null;
  historyEnabled: boolean;
  historyPrompted: boolean;
  createdAt: string;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const sb = await createServerSupabase();
  const { data } = await sb.from("profiles").select("full_name, preferred_locale, preferred_market, history_enabled, consent, created_at").eq("id", userId).maybeSingle();
  if (!data) return null;
  const consent = (data.consent ?? {}) as Record<string, unknown>;
  return {
    fullName: data.full_name,
    preferredLocale: data.preferred_locale,
    preferredMarket: data.preferred_market,
    historyEnabled: data.history_enabled,
    historyPrompted: consent.history_prompted === true,
    createdAt: data.created_at,
  };
}

export async function getFavoriteCards(locale: Locale, market: MarketCode): Promise<ProductCardData[]> {
  const sb = await createServerSupabase();
  const { data } = await sb.from("favorites").select(`created_at, products(${PRODUCT_FIELDS})`).order("created_at", { ascending: false }).limit(200);
  const rows = ((data ?? []) as unknown as { products: Row | null }[]).map((r) => r.products).filter((p): p is Row => !!p && p.status === "published");
  return toCards(rows.map((p) => baseRow(p, locale)), market);
}

export async function getHistoryCards(locale: Locale, market: MarketCode): Promise<ProductCardData[]> {
  const sb = await createServerSupabase();
  const { data } = await sb.from("browsing_history").select(`viewed_at, products(${PRODUCT_FIELDS})`).order("viewed_at", { ascending: false }).limit(200);
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const r of (data ?? []) as unknown as { products: Row | null }[]) {
    if (!r.products || r.products.status !== "published" || seen.has(r.products.id)) continue;
    seen.add(r.products.id);
    rows.push(r.products);
    if (rows.length >= 48) break;
  }
  return toCards(rows.map((p) => baseRow(p, locale)), market);
}

/** Public products by id (guest favourites kept in the browser). */
export async function getCardsByIds(ids: string[], locale: Locale, market: MarketCode): Promise<ProductCardData[]> {
  const valid = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
  if (!valid.length) return [];
  const { data } = await createAnonSupabase().from("products").select(PRODUCT_FIELDS).in("id", valid).eq("status", "published");
  const byId = new Map(((data ?? []) as unknown as Row[]).map((p) => [p.id, p]));
  const ordered = valid.map((id) => byId.get(id)).filter((p): p is Row => !!p);
  return toCards(ordered.map((p) => baseRow(p, locale)), market);
}
