import type { MetadataRoute } from "next";
import { getBusinessModels, getPublicSettings } from "@/lib/data/settings";
import { storefrontLocaleLock } from "@/lib/domain/business-models";
import { LOCALE_PREFIX, DEFAULT_LOCALE } from "@/i18n/routing";

export const revalidate = 3600;

/** Web app manifest (served at /manifest.webmanifest) built from the store branding settings. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [s, bm] = await Promise.all([getPublicSettings(), getBusinessModels()]);
  const locale = storefrontLocaleLock(bm) ?? DEFAULT_LOCALE;
  const description = s.seo[locale]?.description || s.seo[DEFAULT_LOCALE]?.description || undefined;
  return {
    name: s.storeName,
    short_name: s.storeName,
    ...(description ? { description } : {}),
    lang: locale,
    start_url: LOCALE_PREFIX[locale],
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
