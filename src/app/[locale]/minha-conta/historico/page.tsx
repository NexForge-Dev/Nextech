import { getTranslations } from "next-intl/server";
import { History } from "lucide-react";
import { pageLocale } from "@/i18n/page-locale";
import { getStoreContext } from "@/lib/data/context";
import { getSessionUser } from "@/lib/auth/session";
import { getHistoryCards, getProfile } from "@/lib/data/account";
import { getFavoriteIds } from "@/lib/data/favorites";
import { ProductGrid } from "@/components/store/product-grid";
import { HistoryControls } from "@/components/store/account-client";
import { EmptyState } from "@/components/store/ui";

export const metadata = { robots: { index: false } };

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params);
  const user = await getSessionUser();
  // the layout redirects guests; pages render in parallel, so bail out quietly
  if (!user) return null;
  const [ctx, t, profile, favorites] = await Promise.all([getStoreContext(locale), getTranslations("account"), getProfile(user.id), getFavoriteIds()]);
  const items = await getHistoryCards(locale, ctx.market);
  return (
    <div className="space-y-6">
      <h2 className="t-section">{t("history")}</h2>
      <HistoryControls enabled={!!profile?.historyEnabled} hasItems={items.length > 0} />
      {items.length ? <ProductGrid products={items} locale={locale} signedIn favorites={favorites} columns="narrow" /> : <EmptyState icon={History} title={t("historyEmpty")} />}
    </div>
  );
}
