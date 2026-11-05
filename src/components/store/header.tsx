import { getTranslations } from "next-intl/server";
import { Lock, RotateCcw, Truck, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getVisibleCategories } from "@/lib/data/taxonomy";
import { getSessionUser } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Logo } from "./logo";
import { SearchBox } from "./search-box";
import { CategoriesMenu } from "./categories-menu";
import { MobileMenu } from "./mobile-menu";
import { FavoritesLink } from "./favorites-link";
import { CartLink } from "./cart-link";
import { getBusinessModels } from "@/lib/data/settings";

export async function Header({ locale, storeName, logoUrl }: { locale: Locale; storeName: string; logoUrl?: string | null }) {
  const [t, tc, ts, categories, user, bm] = await Promise.all([getTranslations("header"), getTranslations("cart"), getTranslations("store"), getVisibleCategories(locale), getSessionUser(), getBusinessModels()]);
  let favCount = 0;
  if (user) {
    const sb = await createServerSupabase();
    const { count } = await sb.from("favorites").select("id", { count: "exact", head: true });
    favCount = count ?? 0;
  }
  const cats = categories.map((c) => ({ slug: c.slug, name: c.name, icon: c.icon }));
  const accountHref = user ? "/minha-conta" : "/entrar";
  const action = "inline-flex h-11 items-center md:h-10 gap-2 rounded-md px-2.5 text-sm font-medium text-black transition-colors duration-150 hover:bg-soft";
  const bar = "whitespace-nowrap text-sm text-ink transition-colors duration-150 hover:text-black";
  return (
    <header className="sticky top-0 z-40 bg-white">
      {bm.ownStore && (
        <div className="hidden bg-black text-white md:block">
          <ul className="shell flex h-8 items-center justify-center gap-8 text-xs font-medium">
            <li className="flex items-center gap-1.5"><Truck className="size-3.5" strokeWidth={1.75} aria-hidden />{ts("freeShipping")}</li>
            <li className="flex items-center gap-1.5"><Lock className="size-3.5" strokeWidth={1.75} aria-hidden />{ts("securePayment")}</li>
            <li className="flex items-center gap-1.5"><RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />{ts("withdrawal")}</li>
          </ul>
        </div>
      )}
      <div className="border-b border-line">
        <div className="shell flex flex-wrap items-center gap-x-2 gap-y-2.5 py-2.5 md:flex-nowrap md:gap-x-6 md:py-3">
          <MobileMenu
            labels={{
              menu: t("menu"),
              categories: t("categories"),
              deals: t("deals"),
              favorites: t("favorites"),
              account: user ? t("account") : t("signIn"),
              allProducts: t("allProducts"),
            }}
            categories={cats}
            accountHref={accountHref}
            storeName={storeName}
          />
          <Logo name={storeName} logoUrl={logoUrl} />
          <div className="order-last w-full md:order-none md:mx-auto md:max-w-2xl md:flex-1">
            <SearchBox />
          </div>
          <div className="ml-auto flex items-center md:ml-0 md:gap-1">
            <Link href={accountHref} aria-label={user ? t("account") : t("signIn")} className={`${action} hidden md:inline-flex`}>
              <User className="size-5" strokeWidth={1.75} aria-hidden />
              <span className="hidden xl:inline">{user ? t("account") : t("signIn")}</span>
            </Link>
            <FavoritesLink label={t("favorites")} serverCount={favCount} signedIn={!!user} />
            {bm.ownStore && <CartLink label={tc("headerLabel")} />}
          </div>
        </div>
        <nav aria-label={t("categories")} className="hidden border-t border-line md:block">
          <div className="shell flex h-11 items-center gap-6">
            <CategoriesMenu label={t("categories")} allLabel={t("allProducts")} categories={cats} />
            <Link href="/ofertas" className="whitespace-nowrap text-sm font-semibold text-black underline-offset-4 hover:underline">
              {t("deals")}
            </Link>
            <span className="h-4 w-px shrink-0 bg-line" aria-hidden />
            <ul className="flex h-full min-w-0 flex-1 flex-wrap items-center gap-x-6 overflow-hidden">
              {cats.map((c) => (
                <li key={c.slug} className="flex h-full items-center">
                  <Link href={{ pathname: "/categoria/[slug]", params: { slug: c.slug } }} className={bar}>{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
    </header>
  );
}
