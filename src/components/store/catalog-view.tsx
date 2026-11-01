import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { minorDigits } from "@/lib/domain/money";
import { PAGE_SIZE, serializeFilters, type CatalogFilters as Filters } from "@/lib/domain/filters";
import { getFacets, type listProducts } from "@/lib/data/catalog";
import { getCategories } from "@/lib/data/taxonomy";
import { getFavoriteIds } from "@/lib/data/favorites";
import { getSessionUser } from "@/lib/auth/session";
import { getAvailableMarkets } from "@/lib/data/taxonomy";
import { ProductGrid } from "./product-grid";
import { CatalogFilters, SortSelect } from "./catalog-filters";

type Base = { pathname: "/produtos" } | { pathname: "/categoria/[slug]"; params: { slug: string } };

export async function CatalogView({ locale, market, filters, title, description, base, fixedCategory, result }: { locale: Locale; market: string; filters: Filters; title: string; description?: string | null; base: Base; fixedCategory?: string; result: Awaited<ReturnType<typeof listProducts>> }) {
  const t = await getTranslations("catalog");
  const tc = await getTranslations("common");
  const markets = await getAvailableMarkets();
  const currency = markets.find((m) => m.code === market)?.currency ?? "BRL";
  const digits = minorDigits(currency);
  const { items, total } = result;
  const [facets, categories, favorites, user] = await Promise.all([
    getFacets(),
    getCategories(locale),
    getFavoriteIds(),
    getSessionUser(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const values = {
    q: filters.q,
    category: filters.category,
    brand: filters.brand,
    store: filters.store,
    min: filters.min !== undefined ? String(filters.min / 10 ** digits) : undefined,
    max: filters.max !== undefined ? String(filters.max / 10 ** digits) : undefined,
    rating: filters.rating ? String(filters.rating) : undefined,
    discount: filters.discount,
    sort: filters.sort,
  };
  const pageHref = (page: number) => {
    const query = Object.fromEntries(new URLSearchParams(serializeFilters({ ...filters, page }, digits)));
    return base.pathname === "/produtos" ? { pathname: base.pathname, query } : { pathname: base.pathname, params: base.params, query };
  };
  const clearHref = base.pathname === "/produtos" ? { pathname: base.pathname } : { pathname: base.pathname, params: base.params };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 md:px-6">
      <header className="mb-8 border-b border-line pb-8">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-mute">{description}</p>}
        <p className="mt-3 text-sm text-mute" aria-live="polite">{t("count", { count: total })}</p>
      </header>
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside aria-label={t("filters")}>
          <CatalogFilters values={values} categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} brands={facets.brands} stores={facets.stores} hideCategory={!!fixedCategory} />
        </aside>
        <section>
          <div className="mb-6 flex justify-end">
            <SortSelect value={filters.sort} hasQuery={!!filters.q} />
          </div>
          {items.length === 0 ? (
            <div className="rounded-md border border-line px-6 py-16 text-center">
              <p className="text-lg font-semibold">{t("noResultsTitle")}</p>
              <p className="mt-1 text-sm text-mute">{t("noResultsText")}</p>
              <Link href={clearHref} className="mt-6 inline-flex h-10 items-center rounded-md bg-black px-5 text-sm font-medium text-white hover:bg-ink">
                {t("clearFilters")}
              </Link>
            </div>
          ) : (
            <ProductGrid products={items} locale={locale} signedIn={!!user} favorites={favorites} priorityCount={4} />
          )}
          {pages > 1 && (
            <nav className="mt-12 flex items-center justify-center gap-4 text-sm" aria-label={tc("page", { page: filters.page, total: pages })}>
              {filters.page > 1 ? (
                <Link href={pageHref(filters.page - 1)} className="rounded-md border border-line px-4 py-2 hover:bg-soft">{tc("previous")}</Link>
              ) : (
                <span className="rounded-md border border-line px-4 py-2 text-mute">{tc("previous")}</span>
              )}
              <span className="tabular text-mute">{tc("page", { page: filters.page, total: pages })}</span>
              {filters.page < pages ? (
                <Link href={pageHref(filters.page + 1)} className="rounded-md border border-line px-4 py-2 hover:bg-soft">{tc("next")}</Link>
              ) : (
                <span className="rounded-md border border-line px-4 py-2 text-mute">{tc("next")}</span>
              )}
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
