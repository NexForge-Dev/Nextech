import type { Metadata } from "next";
import { LOCALES, LOCALE_PREFIX, pathnames, type InternalPathname, type Locale } from "@/i18n/routing";

export type Href = InternalPathname | { pathname: InternalPathname; params?: Record<string, string> };

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3300").replace(/\/$/, "");
}

/** Localized absolute path (with locale prefix) for an internal pathname — no React context needed. */
export function localizedPath(locale: Locale, href: Href): string {
  const pathname = typeof href === "string" ? href : href.pathname;
  const params = typeof href === "string" ? {} : (href.params ?? {});
  const entry = pathnames[pathname] as string | Record<Locale, string>;
  let template = typeof entry === "string" ? entry : entry[locale];
  for (const [k, v] of Object.entries(params)) template = template.replace(`[${k}]`, encodeURIComponent(v));
  const prefix = LOCALE_PREFIX[locale];
  return template === "/" ? prefix : `${prefix}${template}`;
}

export function absoluteUrl(locale: Locale, href: Href): string {
  return `${siteUrl()}${localizedPath(locale, href)}`;
}

export function alternates(href: Href): Record<string, string> {
  const langs: Record<string, string> = {};
  for (const l of LOCALES) langs[l] = absoluteUrl(l, href);
  langs["x-default"] = absoluteUrl("pt-BR", href);
  return langs;
}

const OG_LOCALE: Record<Locale, string> = { "pt-BR": "pt_BR", "pt-PT": "pt_PT", en: "en_US", es: "es_ES" };

export function buildMetadata(opts: { locale: Locale; href: Href; title: string; description?: string | null; image?: string | null; noindex?: boolean; type?: "website" | "article" }): Metadata {
  const url = absoluteUrl(opts.locale, opts.href);
  const description = opts.description ?? undefined;
  return {
    title: opts.title,
    description,
    alternates: { canonical: url, languages: alternates(opts.href) },
    openGraph: {
      title: opts.title,
      description,
      url,
      siteName: "NEXTECH",
      locale: OG_LOCALE[opts.locale],
      type: opts.type ?? "website",
      ...(opts.image ? { images: [{ url: opts.image }] } : {}),
    },
    twitter: { card: opts.image ? "summary_large_image" : "summary", title: opts.title, description },
    ...(opts.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
