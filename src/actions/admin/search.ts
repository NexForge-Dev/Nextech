"use server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/service";

export type AdminSearchHit = { kind: "Pedido" | "Produto" | "Categoria" | "Loja" | "Campanha" | "Marca"; label: string; sub: string; href: string };

/** Header search across products (name/slug/SKU), categories, stores, brands and campaigns. */
export async function adminSearch(q: string): Promise<AdminSearchHit[]> {
  const ctx = await getAdminContext();
  const term = z.string().trim().min(2).max(80).safeParse(q);
  if (!ctx || !term.success) return [];
  // PostgREST .or() filter syntax: , ( ) " would add or break conditions, so they become spaces
  const like = `%${term.data.replace(/[,()"]/g, " ").replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const sb = await createServerSupabase();
  const [byName, byCode, cats, stores, brands, camps] = await Promise.all([
    sb.from("product_translations").select("product_id, name, products(slug, sku)").eq("locale", "pt-BR").ilike("name", like).limit(8),
    sb.from("products").select("id, slug, sku, product_translations(locale, name)").or(`slug.ilike.${like},sku.ilike.${like}`).limit(5),
    sb.from("category_translations").select("category_id, name, categories(slug)").eq("locale", "pt-BR").ilike("name", like).limit(5),
    sb.from("stores").select("id, name, slug").ilike("name", like).limit(5),
    sb.from("brands").select("id, name, slug").ilike("name", like).limit(5),
    sb.from("campaigns").select("id, name, slug").or(`name.ilike.${like},slug.ilike.${like}`).limit(5),
  ]);
  const hits: AdminSearchHit[] = [];
  const seen = new Set<string>();
  // "#1004" or "1004": jump to the order (orders have no browser policies; read with the service role after the check)
  const orderNumber = /^#?\d{1,9}$/.test(term.data) ? Number(term.data.replace("#", "")) : null;
  if (orderNumber && ctx.permissions.has("orders.read")) {
    const { data: o } = await createServiceSupabase().from("orders").select("number, status, customer").eq("number", orderNumber).maybeSingle();
    if (o) hits.push({ kind: "Pedido", label: `Pedido #${o.number}`, sub: (o.customer as { name?: string } | null)?.name ?? o.status, href: `/admin/pedidos/${o.number}` });
  }
  for (const r of (byName.data ?? []) as unknown as { product_id: string; name: string; products: { slug: string; sku: string | null } | null }[]) {
    seen.add(r.product_id);
    hits.push({ kind: "Produto", label: r.name, sub: r.products?.sku ?? r.products?.slug ?? "", href: `/admin/produtos/${r.product_id}` });
  }
  for (const p of (byCode.data ?? []) as unknown as { id: string; slug: string; sku: string | null; product_translations: { locale: string; name: string }[] }[]) {
    if (seen.has(p.id)) continue;
    hits.push({ kind: "Produto", label: p.product_translations.find((t) => t.locale === "pt-BR")?.name ?? p.slug, sub: p.sku ?? p.slug, href: `/admin/produtos/${p.id}` });
  }
  for (const c of (cats.data ?? []) as unknown as { category_id: string; name: string; categories: { slug: string } | null }[]) hits.push({ kind: "Categoria", label: c.name, sub: c.categories?.slug ?? "", href: `/admin/categorias/${c.category_id}` });
  for (const s of stores.data ?? []) hits.push({ kind: "Loja", label: s.name, sub: s.slug, href: `/admin/lojas/${s.id}` });
  for (const b of brands.data ?? []) hits.push({ kind: "Marca", label: b.name, sub: b.slug, href: `/admin/marcas/${b.id}` });
  for (const c of camps.data ?? []) hits.push({ kind: "Campanha", label: c.name, sub: c.slug, href: `/admin/campanhas/${c.id}` });
  return hits.slice(0, 20);
}
