import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { resolveLocaleParam } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";
import { getStoreContext } from "@/lib/data/context";
import { getPublicSettings } from "@/lib/data/settings";
import { Header } from "@/components/store/header";
import { Footer } from "@/components/store/footer";
import { CookieBanner } from "@/components/store/cookie-banner";
import { FeedbackWidget } from "@/components/store/feedback-widget";
import { Toaster } from "@/components/ui/sonner";
import { siteUrl } from "@/lib/seo/metadata";
import { storagePublicUrl } from "@/lib/supabase/env";
import { AnalyticsScripts } from "@/components/store/analytics-scripts";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocaleParam((await params).locale) ?? "pt-BR";
  const s = await getPublicSettings();
  const seo = s.seo[locale] ?? s.seo["pt-BR"] ?? {};
  const icon = storagePublicUrl("site", s.faviconPath);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: seo.title || s.storeName, template: `%s | ${s.storeName}` },
    description: seo.description,
    applicationName: s.storeName,
    ...(icon ? { icons: { icon } } : {}),
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = resolveLocaleParam((await params).locale);
  if (!locale) notFound();
  setRequestLocale(locale);
  const [ctx, settings, t] = await Promise.all([getStoreContext(locale), getPublicSettings(), getTranslations("common")]);
  return (
    <html lang={locale} className={`${fontVariables} h-full`}>
      <body className="flex min-h-full flex-col bg-white text-black">
        <NextIntlClientProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-black focus:px-4 focus:py-2 focus:text-white"
          >
            {t("skipToContent")}
          </a>
          <Header locale={locale} storeName={settings.storeName} logoUrl={storagePublicUrl("site", settings.logoPath)} />
          <div id="main" className="flex flex-1 flex-col">
            {children}
          </div>
          <Footer ctx={ctx} storeName={settings.storeName} legal={settings.legal} contactEmail={settings.contactEmail} />
          <CookieBanner decided={!!ctx.consent} initial={{ analytics: ctx.consent?.analytics ?? false, marketing: ctx.consent?.marketing ?? false }} texts={settings.cookieTexts[locale]} />
          <FeedbackWidget />
          <Toaster />
          <AnalyticsScripts
            consented={ctx.consent?.analytics === true}
            marketing={ctx.consent?.marketing === true}
            ga4={settings.analytics.ga4}
            plausible={settings.analytics.plausible}
            googleAds={settings.analytics.googleAds}
            googleAdsConversion={settings.analytics.googleAdsConversion}
            metaPixel={settings.analytics.metaPixel}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
