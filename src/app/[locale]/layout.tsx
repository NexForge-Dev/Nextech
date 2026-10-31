import type { ReactNode } from "react";
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
import { Toaster } from "@/components/ui/sonner";

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
          <Header locale={locale} storeName={settings.storeName} />
          <div id="main" className="flex flex-1 flex-col">
            {children}
          </div>
          <Footer ctx={ctx} storeName={settings.storeName} />
          <CookieBanner decided={!!ctx.consent} initial={{ analytics: ctx.consent?.analytics ?? false }} texts={settings.cookieTexts[locale]} />
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
