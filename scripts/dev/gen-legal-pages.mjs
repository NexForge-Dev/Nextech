// One-off generator for the institutional route files (kept for reproducibility).
import { mkdirSync, writeFileSync } from "node:fs";

const pages = [
  ["sobre", "about", "about", false],
  ["como-funciona", "how-it-works", "howItWorks", false],
  ["como-ganhamos-dinheiro", "how-we-earn", "howWeEarn", false],
  ["faq", "faq", "faq", false],
  ["contato", "contact", "contact", false],
  ["privacidade", "privacy", "privacy", true],
  ["termos", "terms", "terms", true],
  ["cookies", "cookies", "cookies", true],
  ["afiliados", "affiliates", "affiliates", false],
];

for (const [route, page, key, updated] of pages) {
  const dir = `src/app/[locale]/${route}`;
  mkdirSync(dir, { recursive: true });
  const isContact = page === "contact";
  const src = `import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { resolveLocaleParam } from "@/i18n/routing";
import { LegalPageView } from "@/components/store/legal-page";
import { buildMetadata } from "@/lib/seo/metadata";
${isContact ? 'import { ContactForm } from "@/components/store/contact-form";\n' : ""}
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = resolveLocaleParam((await params).locale) ?? "pt-BR";
  const t = await getTranslations({ locale, namespace: "legal" });
  return buildMetadata({ locale, href: "/${route}", title: t("${key}") });
}

export default async function Page({ params }: Props) {
  const locale = await pageLocale(params);
  const t = await getTranslations("legal");
  return (
    <LegalPageView page="${page}" locale={locale} title={t("${key}")}${updated ? " showUpdated" : ""}>
      ${isContact ? "<ContactForm locale={locale} />" : "{null}"}
    </LegalPageView>
  );
}
`;
  writeFileSync(`${dir}/page.tsx`, src);
}
console.log("ok");
