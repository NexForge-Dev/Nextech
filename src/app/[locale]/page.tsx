import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";

export default async function HomePlaceholder({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params);
  const t = await getTranslations("home");
  return <main className="mx-auto max-w-6xl p-10 text-4xl font-semibold tracking-tight">{t("heroTitle")}</main>;
}
