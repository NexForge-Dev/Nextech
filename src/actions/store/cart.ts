"use server";
import { z } from "zod";
import { createAnonSupabase } from "@/lib/supabase/server";
import { getBusinessModels } from "@/lib/data/settings";
import { loadSaleInfo } from "@/lib/data/catalog";
import { pickTranslation } from "@/lib/data/translations";
import { buildCartLines, type CartLine, type CartProductRow } from "@/lib/cart/lines";
import { cartTotals } from "@/lib/domain/own-pricing";

const itemsSchema = z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(10) })).max(30);

export type CartView = { lines: CartLine[]; subtotalMinor: number; totalMinor: number; checkoutable: boolean };

/** Current prices and availability for the browser cart (prices always come from the database). */
export async function loadCart(input: unknown): Promise<CartView> {
  const parsed = itemsSchema.safeParse(input);
  if (!parsed.success || !parsed.data.length) return { lines: [], subtotalMinor: 0, totalMinor: 0, checkoutable: false };
  const ids = parsed.data.map((i) => i.productId);
  const [bm, sale, { data }] = await Promise.all([
    getBusinessModels(),
    loadSaleInfo(ids),
    createAnonSupabase().from("products").select("id, slug, status, product_translations(locale, name), product_images(path, is_main, sort_order)").in("id", ids),
  ]);
  const rows: CartProductRow[] = (data ?? []).map((p) => {
    const img = [...p.product_images].sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.sort_order - b.sort_order)[0];
    const info = sale.get(p.id);
    return {
      id: p.id,
      slug: p.slug,
      name: pickTranslation(p.product_translations, "pt-BR")?.name ?? p.slug,
      imagePath: img?.path ?? null,
      saleMode: info?.mode ?? "affiliate",
      published: p.status === "published",
      sale: info?.sale ?? null,
    };
  });
  const lines = buildCartLines(parsed.data, rows, bm);
  const ok = lines.filter((l) => !l.problem);
  const totals = cartTotals(ok, "card");
  return { lines, subtotalMinor: totals.subtotalMinor, totalMinor: totals.totalMinor, checkoutable: ok.length > 0 && ok.length === lines.length };
}
