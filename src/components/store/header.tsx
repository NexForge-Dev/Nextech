import { getTranslations } from "next-intl/server";
import { User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCategories } from "@/lib/data/taxonomy";
import { getSessionUser } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Logo } from "./logo";
import { SearchBox } from "./search-box";
import { CategoriesMenu } from "./categories-menu";
import { MobileMenu, MobileSearch } from "./mobile-menu";
import { FavoritesLink } from "./favorites-link";
import { CartLink } from "./cart-link";
import { getBusinessModels } from "@/lib/data/settings";

export async function Header({ locale, storeName, logoUrl }: { locale: Locale; storeName: string; logoUrl?: string | null }) {
  const [t, tc, categories, user, bm] = await Promise.all([getTranslations("header"), getTranslations("cart"), getCategories(locale), getSessionUser(), getBusinessModels()]);
  let favCount = 0;
  if (user) {
    const sb = await createServerSupabase();
    const { count } = await sb.from("favorites").select("id", { count: "exact", head: true });
    favCount = count ?? 0;
  }
  const cats = categories.map((c) => ({ slug: c.slug, name: c.name, icon: c.icon }));
  const accountHref = user ? "/minha-conta" : "/entrar";
  const navLink = "text-sm text-black transition-colors duration-150 hover:text-ink";
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:gap-8 md:px-6">
        <MobileMenu
          labels={{
            menu: t("menu"),
            openSearch: t("openSearch"),
            categories: t("categories"),
            deals: t("deals"),
            favorites: t("favorites"),
            account: user ? t("account") : t("signIn"),
            allProducts: t("allProducts"),
            searchLabel: t("searchLabel"),
          }}
          categories={cats}
          accountHref={accountHref}
        />
        <Logo name={storeName} logoUrl={logoUrl} />
        <nav className="hidden items-center gap-6 md:flex">
          <CategoriesMenu label={t("categories")} allLabel={t("allProducts")} categories={cats} />
          <Link href="/ofertas" className={navLink}>
            {t("deals")}
          </Link>
        </nav>
        <div className="hidden max-w-md flex-1 md:block">
          <SearchBox />
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-0 md:gap-5">
          <MobileSearch labels={{ openSearch: t("openSearch"), searchLabel: t("searchLabel") }} />
          <div className="grid size-10 place-items-center md:size-auto">
            <FavoritesLink label={t("favorites")} serverCount={favCount} signedIn={!!user} />
          </div>
          {bm.ownStore && (
            <div className="grid size-10 place-items-center md:size-auto">
              <CartLink label={tc("headerLabel")} />
            </div>
          )}
          <Link href={accountHref} aria-label={user ? t("account") : t("signIn")} className={`${navLink} hidden items-center gap-1.5 md:inline-flex`}>
            <User className="size-[18px]" strokeWidth={1.75} aria-hidden />
            <span className="hidden lg:inline">{user ? t("account") : t("signIn")}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
