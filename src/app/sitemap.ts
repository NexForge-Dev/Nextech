import type { MetadataRoute } from "next";
import { createAnonSupabase } from "@/lib/supabase/server";
import { LOCALES, type InternalPathname } from "@/i18n/routing";
import { absoluteUrl, alternates, type Href } from "@/lib/seo/metadata";

export const revalidate = 3600;

const STATIC: InternalPathname[] = ["/", "/produtos", "/ofertas", "/sobre", "/como-funciona", "/como-ganhamos-dinheiro", "/faq", "/contato", "/privacidade", "/termos", "/cookies", "/afiliados"];

function entries(href: Href, lastModified?: string, priority = 0.5): MetadataRoute.Sitemap {
  return LOCALES.map((l) => ({
    url: absoluteUrl(l, href),
    lastModified: lastModified ? new Date(lastModified) : undefined,
    priority,
    alternates: { languages: alternates(href) },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sb = createAnonSupabase();
  const [{ data: products }, { data: categories }, { data: campaigns }] = await Promise.all([
    sb.from("products").select("slug, updated_at").eq("status", "published").limit(45000),
    sb.from("categories").select("slug, updated_at").eq("active", true),
    sb.from("campaigns").select("slug, updated_at").eq("status", "active"),
  ]);
  return [
    ...STATIC.flatMap((p) => entries(p, undefined, p === "/" ? 1 : 0.6)),
    ...(categories ?? []).flatMap((c) => entries({ pathname: "/categoria/[slug]", params: { slug: c.slug } }, c.updated_at, 0.7)),
    ...(products ?? []).flatMap((p) => entries({ pathname: "/produto/[slug]", params: { slug: p.slug } }, p.updated_at, 0.8)),
    ...(campaigns ?? []).flatMap((c) => entries({ pathname: "/campanha/[slug]", params: { slug: c.slug } }, c.updated_at, 0.5)),
  ];
}
