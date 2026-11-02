import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { resolveLocaleParam } from "@/i18n/routing";
import { getBusinessModels, getStorefrontLocales } from "@/lib/data/settings";
import { LegalPageView } from "@/components/store/legal-page";
import { buildMetadata } from "@/lib/seo/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = resolveLocaleParam((await params).locale) ?? "pt-BR";
  const t = await getTranslations({ locale, namespace: "legal" });
  return buildMetadata({ locale, locales: await getStorefrontLocales(), href: "/trocas-e-devolucoes", title: t("returns") });
}

export default async function Page({ params }: Props) {
  if (!(await getBusinessModels()).ownStore) notFound();
  const locale = await pageLocale(params);
  const t = await getTranslations("legal");
  return <LegalPageView page="returns" locale={locale} title={t("returns")} showUpdated />;
}
