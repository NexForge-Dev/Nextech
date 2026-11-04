import { getTranslations } from "next-intl/server";
import { Heart } from "lucide-react";
import { pageLocale } from "@/i18n/page-locale";
import { Link } from "@/i18n/navigation";
import { getStoreContext } from "@/lib/data/context";
import { getFavoriteCards } from "@/lib/data/account";
import { ProductGrid } from "@/components/store/product-grid";
import { EmptyState } from "@/components/store/ui";

export const metadata = { robots: { index: false } };

export default async function AccountFavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params);
  const [ctx, t] = await Promise.all([getStoreContext(locale), getTranslations("favorites")]);
  const items = await getFavoriteCards(locale, ctx.market);
  return (
    <div>
      <h2 className="t-section mb-5">{t("title")}</h2>
      {items.length ? (
        <ProductGrid products={items} locale={locale} signedIn favorites={new Set(items.map((i) => i.id))} columns="narrow" />
      ) : (
        <EmptyState icon={Heart} title={t("emptyTitle")} text={t("emptyText")}>
          <Link href="/produtos" className="btn btn-primary">{t("explore")}</Link>
        </EmptyState>
      )}
    </div>
  );
}
