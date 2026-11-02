import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
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
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 md:px-6">
      <FavoritesSync />
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-mute">{profile?.fullName ? `${profile.fullName} · ` : ""}{user!.email}</p>
        </div>
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="h-10 cursor-pointer rounded-md border border-line px-4 text-sm font-medium hover:bg-soft">{t("signOut")}</button>
        </form>
      </header>
      {profile && !profile.historyPrompted && !profile.historyEnabled && <HistoryPrompt />}
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <AccountNav />
        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}
