import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getBusinessModels, getPublicSettings } from "@/lib/data/settings";
import { LEGAL_UPDATED_AT, loadLegal, type LegalPage } from "@/lib/content/legal";

export async function LegalPageView({ page, locale, title, showUpdated = false, children }: { page: LegalPage; locale: Locale; title: string; showUpdated?: boolean; children?: ReactNode }) {
  const [settings, t, format, bm] = await Promise.all([getPublicSettings(), getTranslations("legal"), getFormatter(), getBusinessModels()]);
  const html = await loadLegal(page, locale, settings, bm.ownStore ? "store" : "default");
  return (
    <main>
      <header className="border-b border-line bg-soft">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-12">
          <h1 className="t-page md:text-4xl">{title}</h1>
          {showUpdated && <p className="mt-2 text-sm text-mute">{t("lastUpdated", { date: format.dateTime(new Date(LEGAL_UPDATED_AT), { dateStyle: "long" }) })}</p>}
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 md:px-6 md:pt-10">
        {page === "about" && settings.institutional[locale] && <p className="mb-8 whitespace-pre-line text-lg text-ink">{settings.institutional[locale]}</p>}
        <div className="prose-nx prose-legal space-y-4 text-[15px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: html }} />
        {children}
      </div>
    </main>
  );
}
