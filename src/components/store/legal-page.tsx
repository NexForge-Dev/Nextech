import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getPublicSettings } from "@/lib/data/settings";
import { LEGAL_UPDATED_AT, loadLegal, type LegalPage } from "@/lib/content/legal";

export async function LegalPageView({ page, locale, title, showUpdated = false, children }: { page: LegalPage; locale: Locale; title: string; showUpdated?: boolean; children?: ReactNode }) {
  const [settings, t, format] = await Promise.all([getPublicSettings(), getTranslations("legal"), getFormatter()]);
  const html = await loadLegal(page, locale, settings);
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-14 md:px-6">
      <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
      {showUpdated && <p className="mt-3 text-sm text-mute">{t("lastUpdated", { date: format.dateTime(new Date(LEGAL_UPDATED_AT), { dateStyle: "long" }) })}</p>}
      <div className="prose-nx prose-legal mt-10 space-y-4 text-[15px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: html }} />
      {children}
    </main>
  );
}
