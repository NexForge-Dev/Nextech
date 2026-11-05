import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { minorDigits } from "@/lib/domain/money";
import { PAGE_SIZE, serializeFilters, type CatalogFilters as Filters } from "@/lib/domain/filters";
import { getFacets, type listProducts } from "@/lib/data/catalog";
import { getBusinessModels } from "@/lib/data/settings";
import { getVisibleCategories } from "@/lib/data/taxonomy";
import { getFavoriteIds } from "@/lib/data/favorites";
import { getSessionUser } from "@/lib/auth/session";
import { getAvailableMarkets } from "@/lib/data/taxonomy";
import { ProductGrid } from "./product-grid";
import { CatalogFilters, SortSelect } from "./catalog-filters";
import { EmptyState } from "./ui";

type Base = { pathname: "/produtos" } | { pathname: "/categoria/[slug]"; params: { slug: string } };

export async function CatalogView({ locale, market, filters, title, description, base, fixedCategory, result }: { locale: Locale; market: string; filters: Filters; title: string; description?: string | null; base: Base; fixedCategory?: string; result: Awaited<ReturnType<typeof listProducts>> }) {
  const t = await getTranslations("catalog");
  const tc = await getTranslations("common");
  const ts = await getTranslations("store");
  const markets = await getAvailableMarkets();
  const currency = markets.find((m) => m.code === market)?.currency ?? "BRL";
  const digits = minorDigits(currency);
  const { items, total } = result;
  const [facets, categories, favorites, user, bm] = await Promise.all([
    getFacets(),
    getVisibleCategories(locale),
    getFavoriteIds(),
    getSessionUser(),
    getBusinessModels(),
  ]);
  const stores = bm.affiliates ? facets.stores : [];
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
  const crumb = "transition-colors duration-150 hover:text-black inline-flex min-h-11 items-center md:min-h-0";

  return (
    <main>
      <div className="border-b border-line bg-soft">
        <header className="shell py-6 md:py-8">
          <nav aria-label={ts("breadcrumb")} className="mb-2 flex items-center gap-1.5 text-xs text-mute">
            <Link href="/" className={crumb}>{ts("home")}</Link>
            {fixedCategory && (
              <>
                <ChevronRight className="size-3" aria-hidden />
                <Link href="/produtos" className={crumb}>{t("title")}</Link>
              </>
            )}
            <ChevronRight className="size-3" aria-hidden />
            <span aria-current="page" className="truncate text-black">{title}</span>
          </nav>
          <h1 className="t-page">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-mute">{description}</p>}
        </header>
      </div>
      <div className="shell grid gap-6 pb-16 pt-6 lg:grid-cols-[256px_minmax(0,1fr)] lg:gap-8 lg:pt-8">
        <aside aria-label={t("filters")} className="hidden lg:block">
          <div className="panel sticky top-44 max-h-[calc(100vh-12rem)] overflow-y-auto p-5">
            <CatalogFilters mode="desktop" values={values} categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} brands={facets.brands} stores={stores} hideCategory={!!fixedCategory} />
          </div>
        </aside>
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <CatalogFilters mode="mobile" values={values} categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} brands={facets.brands} stores={stores} hideCategory={!!fixedCategory} />
              </div>
              <p className="text-sm text-mute" aria-live="polite">{t("count", { count: total })}</p>
            </div>
            <SortSelect value={filters.sort} hasQuery={!!filters.q} />
          </div>
          {items.length === 0 ? (
            <EmptyState icon={SearchX} title={t("noResultsTitle")} text={t("noResultsText")}>
              <Link href={clearHref} className="btn btn-primary">{t("clearFilters")}</Link>
            </EmptyState>
          ) : (
            <ProductGrid products={items} locale={locale} signedIn={!!user} favorites={favorites} priorityCount={4} columns="narrow" />
          )}
          {pages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-3 text-sm" aria-label={tc("page", { page: filters.page, total: pages })}>
              {filters.page > 1 ? (
                <Link href={pageHref(filters.page - 1)} className="btn btn-secondary"><ChevronLeft aria-hidden />{tc("previous")}</Link>
              ) : (
                <span aria-disabled="true" className="btn btn-secondary pointer-events-none opacity-50"><ChevronLeft aria-hidden />{tc("previous")}</span>
              )}
              <span className="tabular px-2 text-mute">{tc("page", { page: filters.page, total: pages })}</span>
              {filters.page < pages ? (
                <Link href={pageHref(filters.page + 1)} className="btn btn-secondary">{tc("next")}<ChevronRight aria-hidden /></Link>
              ) : (
                <span aria-disabled="true" className="btn btn-secondary pointer-events-none opacity-50">{tc("next")}<ChevronRight aria-hidden /></span>
              )}
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
