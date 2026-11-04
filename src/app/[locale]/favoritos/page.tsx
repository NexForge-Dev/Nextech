import { getTranslations } from "next-intl/server";
import { Heart } from "lucide-react";
import { pageLocale } from "@/i18n/page-locale";
import { Link, redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getStoreContext } from "@/lib/data/context";
import { getCardsByIds } from "@/lib/data/account";
import { ProductGrid } from "@/components/store/product-grid";
import { GuestFavoritesLoader } from "@/components/store/account-client";
import { EmptyState } from "@/components/store/ui";

export const metadata = { robots: { index: false } };

export default async function GuestFavoritesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ids?: string }> }) {
  const locale = await pageLocale(params);
  if (await getSessionUser()) redirect({ href: "/minha-conta/favoritos", locale });
  const [ctx, t, ta] = await Promise.all([getStoreContext(locale), getTranslations("favorites"), getTranslations("auth")]);
  const raw = (await searchParams).ids;
  const ids = raw ? raw.split(",") : [];
  const items = await getCardsByIds(ids, locale, ctx.market);
  return (
    <main className="shell pb-16 pt-8 md:pt-10">
      <GuestFavoritesLoader hasIds={ids.length > 0} />
      <header className="mb-6">
        <h1 className="t-page">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          {t("guestNote")}{" "}
          <Link href="/entrar" className="font-medium text-black underline underline-offset-2">
            {ta("signIn")}
          </Link>
        </p>
      </header>
      {items.length ? (
        <ProductGrid products={items} locale={locale} signedIn={false} />
      ) : (
        <EmptyState icon={Heart} title={t("emptyTitle")} text={t("emptyText")}>
          <Link href="/produtos" className="btn btn-primary">{t("explore")}</Link>
        </EmptyState>
      )}
    </main>
  );
}
