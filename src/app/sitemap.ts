import type { MetadataRoute } from "next";
import { createAnonSupabase } from "@/lib/supabase/server";
import { LOCALES, type InternalPathname } from "@/i18n/routing";
import { absoluteUrl, alternates, type Href } from "@/lib/seo/metadata";
import { getBusinessModels } from "@/lib/data/settings";
import { storefrontLocaleLock, visibleModes } from "@/lib/domain/business-models";
import { listableProducts } from "@/lib/seo/sitemap-products";
import type { Locale } from "@/i18n/routing";

export const revalidate = 3600;

const STATIC: InternalPathname[] = ["/", "/produtos", "/ofertas", "/sobre", "/como-funciona", "/faq", "/contato", "/privacidade", "/termos", "/cookies"];
const AFFILIATE_STATIC: InternalPathname[] = ["/como-ganhamos-dinheiro", "/afiliados"];
const STORE_STATIC: InternalPathname[] = ["/trocas-e-devolucoes", "/entrega"];

function entries(locales: readonly Locale[], href: Href, lastModified?: string, priority = 0.5): MetadataRoute.Sitemap {
  return locales.map((l) => ({
    url: absoluteUrl(l, href),
    lastModified: lastModified ? new Date(lastModified) : undefined,
    priority,
    alternates: { languages: alternates(href) },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sb = createAnonSupabase();
  const bm = await getBusinessModels();
  const lock = storefrontLocaleLock(bm);
  const locales: readonly Locale[] = lock ? [lock] : LOCALES;
  const modes = visibleModes(bm);
  const statics = [...STATIC, ...(bm.affiliates ? AFFILIATE_STATIC : []), ...(bm.ownStore ? STORE_STATIC : [])];
  const [{ data: products }, { data: categories }, { data: campaigns }] = await Promise.all([
    sb.from("products").select("slug, updated_at, sale_mode, product_sale(product_id)").eq("status", "published").in("sale_mode", modes.length ? modes : ["none"]).limit(45000),
    sb.from("categories").select("slug, updated_at").eq("active", true),
    sb.from("campaigns").select("slug, updated_at").eq("status", "active"),
  ]);
  return [
    ...statics.flatMap((p) => entries(locales, p, undefined, p === "/" ? 1 : 0.6)),
    ...(categories ?? []).flatMap((c) => entries(locales, { pathname: "/categoria/[slug]", params: { slug: c.slug } }, c.updated_at, 0.7)),
    ...listableProducts(products ?? []).flatMap((p) => entries(locales, { pathname: "/produto/[slug]", params: { slug: p.slug } }, p.updated_at, 0.8)),
    ...(campaigns ?? []).flatMap((c) => entries(locales, { pathname: "/campanha/[slug]", params: { slug: c.slug } }, c.updated_at, 0.5)),
  ];
}
