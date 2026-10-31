import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { resolveLocaleParam } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getStoreContext } from "@/lib/data/context";
import { listActivePromotions } from "@/lib/data/promotions";
import { getFavoriteIds } from "@/lib/data/favorites";
import { getSessionUser } from "@/lib/auth/session";
import { ProductGrid } from "@/components/store/product-grid";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = resolveLocaleParam((await params).locale) ?? "pt-BR";
  const t = await getTranslations({ locale, namespace: "deals" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function DealsPage({ params }: Props) {
  const locale = await pageLocale(params);
  const [ctx, t, tf, user, favorites] = await Promise.all([getStoreContext(locale), getTranslations("deals"), getTranslations("favorites"), getSessionUser(), getFavoriteIds()]);
  const { items, reasons } = await listActivePromotions(locale, ctx.market);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 md:px-6">
      <header className="mb-10 border-b border-line pb-8">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="mt-2 text-mute">{t("subtitle")}</p>
      </header>
      {items.length === 0 ? (
        <div className="rounded-md border border-line px-6 py-16 text-center">
          <p className="text-lg font-semibold">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-mute">{t("emptyText")}</p>
          <Link href="/produtos" className="mt-6 inline-flex h-10 items-center rounded-md bg-black px-5 text-sm font-medium text-white hover:bg-ink">
            {tf("explore")}
          </Link>
        </div>
      ) : (
        <ProductGrid products={items} locale={locale} signedIn={!!user} favorites={favorites} notes={reasons} priorityCount={4} />
      )}
    </main>
  );
}
