import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { resolveLocaleParam, type Locale } from "./routing";

/** Resolve the `[locale]` param, register it for next-intl and return it (404 when unknown). */
export async function pageLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const locale = resolveLocaleParam((await params).locale);
  if (!locale) notFound();
  setRequestLocale(locale);
  return locale;
}
