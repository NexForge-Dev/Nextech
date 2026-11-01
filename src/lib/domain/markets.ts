import type { Locale } from "@/i18n/routing";

export type { Locale };
/** ISO-3166 alpha-2 country code, upper case. */
export type MarketCode = string;

const DEFAULT_MARKET: Record<Locale, MarketCode> = { "pt-BR": "BR", "pt-PT": "PT", en: "US", es: "ES" };

export const MARKET_COOKIE = "nx_market";

export function defaultMarketFor(locale: Locale): MarketCode {
  return DEFAULT_MARKET[locale];
}

/**
 * The visitor's market: a valid cookie choice among available markets, otherwise the locale default
 * (kept even if no store serves it, so the page can say "not available in this country").
 */
export function resolveMarket(cookieValue: string | undefined, locale: Locale, available: MarketCode[]): MarketCode {
  const c = cookieValue?.trim().toUpperCase();
  if (c && /^[A-Z]{2}$/.test(c) && available.includes(c)) return c;
  return defaultMarketFor(locale);
}
