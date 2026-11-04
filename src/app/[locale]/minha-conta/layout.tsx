import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { redirect } from "@/i18n/navigation";
import { getPathname } from "@/i18n/navigation";
import { pageLocale } from "@/i18n/page-locale";
import { getSessionUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/data/account";
import { signOut } from "@/actions/store/auth";
import { AccountNav } from "@/components/store/account-nav";
import { FavoritesSync, HistoryPrompt } from "@/components/store/account-client";

export default async function AccountLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params);
  const user = await getSessionUser();
  if (!user) {
    const next = getPathname({ locale, href: "/minha-conta" });
    redirect({ href: { pathname: "/entrar", query: { next } }, locale });
  }
  const [t, profile] = await Promise.all([getTranslations("account"), getProfile(user!.id)]);
  return (
    <main className="shell pb-16 pt-6 md:pt-10">
      <FavoritesSync />
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="t-page">{t("title")}</h1>
          <p className="mt-1 truncate text-sm text-mute">{profile?.fullName ? `${profile.fullName} · ` : ""}{user!.email}</p>
        </div>
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="btn btn-secondary"><LogOut aria-hidden />{t("signOut")}</button>
        </form>
      </header>
      {profile && !profile.historyPrompted && !profile.historyEnabled && <HistoryPrompt />}
      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <AccountNav />
        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}
