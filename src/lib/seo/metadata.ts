import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, LOCALE_PREFIX, pathnames, type InternalPathname, type Locale } from "@/i18n/routing";

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

/**
 * hreflang alternates. Pass only the locales the storefront actually serves: while the own store runs
 * alone (affiliates off) that is just pt-BR, and listing the other locales would point search engines
 * at URLs that redirect.
 */
export function alternates(href: Href, locales: readonly Locale[] = LOCALES): Record<string, string> {
  const langs: Record<string, string> = {};
  for (const l of locales) langs[l] = absoluteUrl(l, href);
  langs["x-default"] = absoluteUrl(locales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : locales[0], href);
  return langs;
}

const OG_LOCALE: Record<Locale, string> = { "pt-BR": "pt_BR", "pt-PT": "pt_PT", en: "en_US", es: "es_ES" };

const TRACKING_PARAM = /^(utm_\w+|gclid|gbraid|wbraid|fbclid|msclkid|ttclid|_gl)$/;

/** Listing query that changes the content (filters/sort/search): such URLs are noindex. Paging and ad-click ids are not filters. */
export function isFilteredQuery(sp: Record<string, unknown>): boolean {
  return Object.keys(sp).some((k) => k !== "page" && !TRACKING_PARAM.test(k));
}

/** Page number from a listing query (1 when absent/invalid). */
export function pageParam(sp: Record<string, unknown>): number {
  const n = Number(typeof sp.page === "string" ? sp.page : 1);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

export function buildMetadata(opts: { locale: Locale; locales?: readonly Locale[]; href: Href; title: string; description?: string | null; image?: string | null; noindex?: boolean; type?: "website" | "article"; page?: number }): Metadata {
  const locales = opts.locales ?? LOCALES;
  // paginated listings canonicalise to themselves so deeper pages stay discoverable
  const suffix = opts.page && opts.page > 1 ? `?page=${opts.page}` : "";
  // a locale the storefront does not serve redirects to the primary one: canonicalise there
  const url = absoluteUrl(locales.includes(opts.locale) ? opts.locale : locales[0], opts.href) + suffix;
  const description = opts.description ?? undefined;
  return {
    title: opts.title,
    description,
    alternates: { canonical: url, languages: Object.fromEntries(Object.entries(alternates(opts.href, locales)).map(([k, v]) => [k, v + suffix])) },
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
