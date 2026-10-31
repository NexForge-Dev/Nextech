import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { resolveLocaleParam } from "@/i18n/routing";
import { getStoreContext } from "@/lib/data/context";
import { parseFilters } from "@/lib/domain/filters";
import { minorDigits } from "@/lib/domain/money";
import { getAvailableMarkets } from "@/lib/data/taxonomy";
import { getSessionUser } from "@/lib/auth/session";
import { recordEvent } from "@/lib/tracking/events";
import { listProducts } from "@/lib/data/catalog";
import { CatalogView } from "@/components/store/catalog-view";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function toSearchParams(sp: Record<string, string | string[] | undefined>) {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") out.set(k, v);
  return out;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = resolveLocaleParam((await params).locale) ?? "pt-BR";
  const t = await getTranslations({ locale, namespace: "catalog" });
  const sp = await searchParams;
  const filtered = Object.keys(sp).some((k) => k !== "page");
  return { title: t("title"), robots: filtered ? { index: false, follow: true } : undefined };
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const locale = await pageLocale(params);
  const [ctx, t, markets, user] = await Promise.all([getStoreContext(locale), getTranslations("catalog"), getAvailableMarkets(), getSessionUser()]);
  const currency = markets.find((m) => m.code === ctx.market)?.currency ?? "BRL";
  const filters = parseFilters(toSearchParams(await searchParams), minorDigits(currency));
  const result = await listProducts(filters, locale, ctx.market);
  if (filters.q && filters.page === 1) {
    await recordEvent({ type: "search", locale, market: ctx.market, query: filters.q, results: result.total, userId: user?.id });
  }
  return (
    <CatalogView
      locale={locale}
      market={ctx.market}
      filters={filters}
      result={result}
      title={filters.q ? t("resultsFor", { q: filters.q }) : t("title")}
      base={{ pathname: "/produtos" }}
    />
  );
}
