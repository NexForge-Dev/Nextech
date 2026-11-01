import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, resolveLocaleParam } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : (requested && resolveLocaleParam(requested)) || routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: locale === "pt-BR" ? "America/Sao_Paulo" : locale === "pt-PT" ? "Europe/Lisbon" : locale === "es" ? "Europe/Madrid" : "America/New_York",
  };
});
