import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusinessModels } from "@/lib/data/settings";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { resolveLocaleParam } from "@/i18n/routing";
import { LegalPageView } from "@/components/store/legal-page";
import { buildMetadata } from "@/lib/seo/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = resolveLocaleParam((await params).locale) ?? "pt-BR";
  const t = await getTranslations({ locale, namespace: "legal" });
  return buildMetadata({ locale, href: "/afiliados", title: t("affiliates") });
}

export default async function Page({ params }: Props) {
  if (!(await getBusinessModels()).affiliates) notFound();
  const locale = await pageLocale(params);
  const t = await getTranslations("legal");
  return (
    <LegalPageView page="affiliates" locale={locale} title={t("affiliates")}>
      {null}
    </LegalPageView>
  );
}
