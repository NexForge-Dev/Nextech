import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Locale } from "@/i18n/routing";
import { MARKET_COOKIE, resolveMarket, type MarketCode } from "@/lib/domain/markets";
import { CONSENT_COOKIE, parseConsent, type Consent } from "@/lib/domain/consent";
import { getAvailableMarkets } from "./taxonomy";

export type StoreContext = { locale: Locale; market: MarketCode; consent: Consent | null; availableMarkets: string[] };

export const getStoreContext = cache(async (locale: Locale): Promise<StoreContext> => {
  const [jar, markets] = await Promise.all([cookies(), getAvailableMarkets()]);
  const availableMarkets = markets.map((m) => m.code);
  return {
    locale,
    market: resolveMarket(jar.get(MARKET_COOKIE)?.value, locale, availableMarkets),
    consent: parseConsent(jar.get(CONSENT_COOKIE)?.value),
    availableMarkets,
  };
});
