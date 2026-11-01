import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { LOCALES } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/data/account";
import { getStoreContext } from "@/lib/data/context";
import { PreferencesForm } from "@/components/store/preferences-form";

export const metadata = { robots: { index: false } };

const LANGUAGE_NAMES: Record<string, string> = { "pt-BR": "Português (Brasil)", "pt-PT": "Português (Portugal)", en: "English", es: "Español" };

export default async function PreferencesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params);
  const user = await getSessionUser();
  // the layout redirects guests; pages render in parallel, so bail out quietly
  if (!user) return null;
  const [t, tm, profile, ctx] = await Promise.all([getTranslations("account"), getTranslations("markets"), getProfile(user.id), getStoreContext(locale)]);
  return (
    <div className="max-w-lg">
      <h2 className="mb-6 text-xl font-semibold tracking-tight">{t("preferences")}</h2>
      <PreferencesForm
        locale={locale}
        languages={LOCALES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))}
        markets={ctx.availableMarkets.map((m) => ({ value: m, label: tm.has(m as "BR") ? tm(m as "BR") : m }))}
        current={{ locale: profile?.preferredLocale ?? locale, market: profile?.preferredMarket ?? ctx.market }}
      />
    </div>
  );
}
