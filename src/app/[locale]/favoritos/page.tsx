import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { Link, redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getStoreContext } from "@/lib/data/context";
import { getCardsByIds } from "@/lib/data/account";
import { ProductGrid } from "@/components/store/product-grid";
import { GuestFavoritesLoader } from "@/components/store/account-client";

export const metadata = { robots: { index: false } };

export default async function GuestFavoritesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ids?: string }> }) {
  const locale = await pageLocale(params);
  if (await getSessionUser()) redirect({ href: "/minha-conta/favoritos", locale });
  const [ctx, t, ta] = await Promise.all([getStoreContext(locale), getTranslations("favorites"), getTranslations("auth")]);
  const raw = (await searchParams).ids;
  const ids = raw ? raw.split(",") : [];
  const items = await getCardsByIds(ids, locale, ctx.market);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 md:px-6">
      <GuestFavoritesLoader hasIds={ids.length > 0} />
      <header className="mb-8 border-b border-line pb-8">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
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
        <div className="rounded-md border border-line px-6 py-14 text-center">
          <p className="font-semibold">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-mute">{t("emptyText")}</p>
          <Link href="/produtos" className="mt-6 inline-flex h-10 items-center rounded-md bg-black px-5 text-sm font-medium text-white hover:bg-ink">
            {t("explore")}
          </Link>
        </div>
      )}
    </main>
  );
}
