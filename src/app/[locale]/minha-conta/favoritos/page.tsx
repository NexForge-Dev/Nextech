import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { Link } from "@/i18n/navigation";
import { getStoreContext } from "@/lib/data/context";
import { getFavoriteCards } from "@/lib/data/account";
import { ProductGrid } from "@/components/store/product-grid";

export const metadata = { robots: { index: false } };

export default async function AccountFavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params);
  const [ctx, t] = await Promise.all([getStoreContext(locale), getTranslations("favorites")]);
  const items = await getFavoriteCards(locale, ctx.market);
  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold tracking-tight">{t("title")}</h2>
      {items.length ? (
        <ProductGrid products={items} locale={locale} signedIn favorites={new Set(items.map((i) => i.id))} />
      ) : (
        <div className="rounded-md border border-line px-6 py-14 text-center">
          <p className="font-semibold">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-mute">{t("emptyText")}</p>
          <Link href="/produtos" className="mt-6 inline-flex h-10 items-center rounded-md bg-black px-5 text-sm font-medium text-white hover:bg-ink">
            {t("explore")}
          </Link>
        </div>
      )}
    </div>
  );
}
