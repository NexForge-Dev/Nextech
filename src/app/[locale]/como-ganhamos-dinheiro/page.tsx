import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { resolveLocaleParam } from "@/i18n/routing";
import { LegalPageView } from "@/components/store/legal-page";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = resolveLocaleParam((await params).locale) ?? "pt-BR";
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("howWeEarn") };
}

export default async function Page({ params }: Props) {
  const locale = await pageLocale(params);
  const t = await getTranslations("legal");
  return (
    <LegalPageView page="how-we-earn" locale={locale} title={t("howWeEarn")}>
      {null}
    </LegalPageView>
  );
}
