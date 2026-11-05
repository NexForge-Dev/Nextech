"use server";
import { after } from "next/server";
import { z } from "zod";
import { createAnonSupabase } from "@/lib/supabase/server";
import { getBusinessModels } from "@/lib/data/settings";
import { loadSaleInfo } from "@/lib/data/catalog";
import { pickTranslation } from "@/lib/data/translations";
import { buildCartLines, type CartLine, type CartProductRow } from "@/lib/cart/lines";
import { cartTotals } from "@/lib/domain/own-pricing";
import { getSessionUser } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/service";
import { releaseExpiredHolds } from "@/lib/orders/expire";

const itemsSchema = z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(10) })).max(30);

export type CartView = { lines: CartLine[]; subtotalMinor: number; totalMinor: number; checkoutable: boolean };

/** Units this customer holds in unpaid card/Pix orders: coming back to pay must not show them as sold out. */
async function myHeldUnits(productIds: string[]): Promise<Map<string, number>> {
  const held = new Map<string, number>();
  const user = await getSessionUser();
  if (!user) return held;
  const { data } = await createServiceSupabase()
    .from("order_items")
    .select("product_id, stock_taken, orders!inner(user_id, status, payment_method)")
    .in("product_id", productIds)
    .gt("stock_taken", 0)
    .eq("orders.user_id", user.id)
    .eq("orders.status", "awaiting_payment")
    .in("orders.payment_method", ["card", "pix"]);
  for (const r of data ?? []) if (r.product_id) held.set(r.product_id, (held.get(r.product_id) ?? 0) + r.stock_taken);
  return held;
}

/** Current prices and availability for the browser cart (prices always come from the database). */
export async function loadCart(input: unknown): Promise<CartView> {
  const parsed = itemsSchema.safeParse(input);
  if (!parsed.success || !parsed.data.length) return { lines: [], subtotalMinor: 0, totalMinor: 0, checkoutable: false };
  const ids = parsed.data.map((i) => i.productId);
  const [bm, sale, held, { data }] = await Promise.all([
    getBusinessModels(),
    loadSaleInfo(ids),
    myHeldUnits(ids),
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
  const lines = buildCartLines(parsed.data, rows, bm, held);
  // something looks sold out: the units may be in an expired order nobody will pay
  if (lines.some((l) => l.problem === "short" || (l.problem === "unavailable" && l.maxQuantity != null))) after(() => releaseExpiredHolds());
  const ok = lines.filter((l) => !l.problem);
  const totals = cartTotals(ok, "card");
  return { lines, subtotalMinor: totals.subtotalMinor, totalMinor: totals.totalMinor, checkoutable: ok.length > 0 && ok.length === lines.length };
}
