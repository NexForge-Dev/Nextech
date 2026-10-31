import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { resolveLocaleParam } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = resolveLocaleParam((await params).locale);
  if (!locale) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} className={`${fontVariables} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-black">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
