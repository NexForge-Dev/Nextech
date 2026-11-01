import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonSupabase } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";

export type PublicSettings = {
  storeName: string;
  contactEmail: string;
  socials: Record<string, string>;
  seo: Partial<Record<Locale, { title?: string; description?: string }>>;
  legal: { company_name: string; tax_id: string; address: string };
  analytics: { ga4: string; plausible: string; googleAds: string; googleAdsConversion: string; metaPixel: string };
  cookieTexts: Partial<Record<Locale, { title?: string; text?: string }>>;
  institutional: Partial<Record<Locale, string>>;
  logoPath: string | null;
  faviconPath: string | null;
  heroImage: string | null;
};

const DEFAULTS: PublicSettings = {
  storeName: "NEXTECH",
  contactEmail: "",
  socials: {},
  seo: {},
  legal: { company_name: "", tax_id: "", address: "" },
  analytics: { ga4: "", plausible: "", googleAds: "", googleAdsConversion: "", metaPixel: "" },
  cookieTexts: {},
  institutional: {},
  logoPath: null,
  faviconPath: null,
  heroImage: null,
};

export const getPublicSettings = unstable_cache(
  async (): Promise<PublicSettings> => {
    const { data, error } = await createAnonSupabase().from("site_settings").select("key, value").like("key", "public.%");
    if (error || !data) return DEFAULTS;
    const m = new Map(data.map((r) => [r.key, r.value as unknown]));
    const str = (k: string, d: string) => (typeof m.get(k) === "string" ? (m.get(k) as string) : d);
    const obj = <T,>(k: string, d: T): T => {
      const v = m.get(k);
      return v && typeof v === "object" && !Array.isArray(v) ? ({ ...d, ...(v as object) } as T) : d;
    };
    const nullableStr = (k: string) => (typeof m.get(k) === "string" && (m.get(k) as string) ? (m.get(k) as string) : null);
    return {
      storeName: str("public.store_name", DEFAULTS.storeName) || DEFAULTS.storeName,
      contactEmail: str("public.contact_email", ""),
      socials: obj("public.socials", {}),
      seo: obj("public.seo", {}),
      legal: obj("public.legal", DEFAULTS.legal),
      analytics: obj("public.analytics", DEFAULTS.analytics),
      cookieTexts: obj("public.cookie_texts", {}),
      institutional: obj("public.institutional", {}),
      logoPath: nullableStr("public.logo_path"),
      faviconPath: nullableStr("public.favicon_path"),
      heroImage: nullableStr("public.hero_image"),
    };
  },
  ["public-settings"],
  { tags: ["settings"], revalidate: 300 },
);
