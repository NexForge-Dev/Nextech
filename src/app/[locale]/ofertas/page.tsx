import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { resolveLocaleParam } from "@/i18n/routing";
import { Tag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getStoreContext } from "@/lib/data/context";
import { listActivePromotions } from "@/lib/data/promotions";
import { getFavoriteIds } from "@/lib/data/favorites";
import { getSessionUser } from "@/lib/auth/session";
import { ProductGrid } from "@/components/store/product-grid";
import { EmptyState } from "@/components/store/ui";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStorefrontLocales } from "@/lib/data/settings";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = resolveLocaleParam((await params).locale) ?? "pt-BR";
  const t = await getTranslations({ locale, namespace: "deals" });
  return buildMetadata({ locale, locales: await getStorefrontLocales(), href: "/ofertas", title: t("title"), description: t("subtitle") });
}

export default async function DealsPage({ params }: Props) {
  const locale = await pageLocale(params);
  const [ctx, t, tf, user, favorites] = await Promise.all([getStoreContext(locale), getTranslations("deals"), getTranslations("favorites"), getSessionUser(), getFavoriteIds()]);
  const { items, reasons } = await listActivePromotions(locale, ctx.market);
  return (
    <main>
      <header className="bg-black text-white">
        <div className="shell py-8 md:py-12">
          <h1 className="t-page text-white md:text-4xl">{t("title")}</h1>
          <p className="mt-2 text-sm text-white/70 md:text-base">{t("subtitle")}</p>
        </div>
      </header>
      <div className="shell py-8 pb-16">
        {items.length === 0 ? (
          <EmptyState icon={Tag} title={t("emptyTitle")} text={t("emptyText")}>
            <Link href="/produtos" className="btn btn-primary">{tf("explore")}</Link>
          </EmptyState>
        ) : (
          <ProductGrid products={items} locale={locale} signedIn={!!user} favorites={favorites} notes={reasons} priorityCount={4} />
        )}
      </div>
    </main>
  );
}
