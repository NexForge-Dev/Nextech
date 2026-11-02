import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

export function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error("e2e must run against local Supabase");
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

/** Run `fn` with every published product temporarily archived (empty-store state). */
export async function withEmptyCatalog(fn: () => Promise<void>) {
  const s = svc();
  const { data } = await s.from("products").select("id").eq("status", "published");
  const ids = (data ?? []).map((r) => r.id);
  if (ids.length) await s.from("products").update({ status: "archived" }).in("id", ids);
  try {
    await fn();
  } finally {
    if (ids.length) await s.from("products").update({ status: "published" }).in("id", ids);
  }
}

export async function acceptCookies(page: import("@playwright/test").Page) {
  await page.context().addCookies([
    { name: "nx_consent", value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, marketing: false, decidedAt: new Date().toISOString() })), url: `http://localhost:${process.env.E2E_PORT ?? 3300}` },
  ]);
}

/** Switch business models (read uncached by the app, so it applies on the next request). */
export async function setBusinessModels(v: { ownStore: boolean; affiliates: boolean; pix?: boolean }) {
  const { error } = await svc()
    .from("site_settings")
    .upsert({ key: "public.business_models", value: { own_store: v.ownStore, affiliates: v.affiliates, payments: { card: true, boleto: true, pix: v.pix ?? false } } });
  if (error) throw error;
}

/** Published own-store product (BRL) for e2e; returns its id and slug. Delete with deleteProduct(). */
export async function makeOwnProduct(opts: { name: string; priceMinor: number; compareAtMinor?: number | null; available?: boolean; pixDiscountPct?: number }) {
  const s = svc();
  const slug = `${opts.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now().toString(36)}`;
  const { data: cat } = await s.from("categories").select("id").eq("slug", "eletronicos").single();
  const { data: p, error } = await s
    .from("products")
    .insert({ slug, category_id: cat!.id, status: "published", published_at: new Date().toISOString(), sale_mode: "own" })
    .select("id")
    .single();
  if (error) throw error;
  await s.from("product_translations").insert({ product_id: p!.id, locale: "pt-BR", name: opts.name });
  await s.from("product_sale").insert({ product_id: p!.id, price_minor: opts.priceMinor, compare_at_minor: opts.compareAtMinor ?? null, available: opts.available ?? true, pix_discount_pct: opts.pixDiscountPct ?? 0 });
  return { id: p!.id as string, slug };
}

export async function deleteProduct(id: string) {
  await svc().from("products").delete().eq("id", id);
}
