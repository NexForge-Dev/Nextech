import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { resolveLocaleParam } from "@/i18n/routing";
import { getStoreContext } from "@/lib/data/context";
import { parseFilters } from "@/lib/domain/filters";
import { minorDigits } from "@/lib/domain/money";
import { getAvailableMarkets, getCategories } from "@/lib/data/taxonomy";
import { listProducts } from "@/lib/data/catalog";
import { recordEvent } from "@/lib/tracking/events";
import { CatalogView } from "@/components/store/catalog-view";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const p = await params;
  const locale = resolveLocaleParam(p.locale) ?? "pt-BR";
  const category = (await getCategories(locale)).find((c) => c.slug === p.slug);
  if (!category) return {};
  const filtered = Object.keys(await searchParams).some((k) => k !== "page");
  return { title: category.name, description: category.description ?? undefined, robots: filtered ? { index: false, follow: true } : undefined };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const locale = await pageLocale(params);
  const { slug } = await params;
  const category = (await getCategories(locale)).find((c) => c.slug === slug);
  if (!category) notFound();
  const [ctx, markets, t] = await Promise.all([getStoreContext(locale), getAvailableMarkets(), getTranslations("catalog")]);
  const currency = markets.find((m) => m.code === ctx.market)?.currency ?? "BRL";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") sp.set(k, v);
  const filters = parseFilters(sp, minorDigits(currency));
  const result = await listProducts({ ...filters, category: category.slug }, locale, ctx.market);
  await recordEvent({ type: "category_view", categoryId: category.id, locale, market: ctx.market });
  return (
    <CatalogView
      locale={locale}
      market={ctx.market}
      filters={filters}
      result={result}
      fixedCategory={category.slug}
      title={category.name}
      description={category.description ?? (result.total ? null : t("noResultsText"))}
      base={{ pathname: "/categoria/[slug]", params: { slug: category.slug } }}
    />
  );
}
