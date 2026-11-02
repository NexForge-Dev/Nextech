import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Locale } from "@/i18n/routing";
import { MARKET_COOKIE, resolveMarket, type MarketCode } from "@/lib/domain/markets";
import { CONSENT_COOKIE, parseConsent, type Consent } from "@/lib/domain/consent";
import { getAvailableMarkets } from "./taxonomy";
import { getBusinessModels } from "./settings";
import { storefrontLocaleLock, type BusinessModels } from "@/lib/domain/business-models";

export type StoreContext = {
  locale: Locale;
  market: MarketCode;
  consent: Consent | null;
  availableMarkets: string[];
  businessModels: BusinessModels;
  /** Own store only: Brazil, pt-BR, no locale/market switching. */
  brazilOnly: boolean;
};

export const getStoreContext = cache(async (locale: Locale): Promise<StoreContext> => {
  const [jar, markets, businessModels] = await Promise.all([cookies(), getAvailableMarkets(), getBusinessModels()]);
  const brazilOnly = storefrontLocaleLock(businessModels) !== null;
  const availableMarkets = brazilOnly ? ["BR"] : markets.map((m) => m.code);
  return {
    locale,
    market: brazilOnly ? "BR" : resolveMarket(jar.get(MARKET_COOKIE)?.value, locale, availableMarkets),
    consent: parseConsent(jar.get(CONSENT_COOKIE)?.value),
    availableMarkets,
    businessModels,
    brazilOnly,
  };
});
