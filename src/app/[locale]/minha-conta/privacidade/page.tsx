import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { getSessionUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/data/account";
import { CookiePreferencesButton } from "@/components/store/cookie-banner";
import { DeleteAccountForm, HistoryControls } from "@/components/store/account-client";

export const metadata = { robots: { index: false } };

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params);
  const user = await getSessionUser();
  // the layout redirects guests; pages render in parallel, so bail out quietly
  if (!user) return null;
  const [t, profile] = await Promise.all([getTranslations("account"), getProfile(user.id)]);
  const block = "border-b border-line pb-8";
  return (
    <div className="max-w-2xl space-y-8">
      <h2 className="text-xl font-semibold tracking-tight">{t("privacy")}</h2>
      <div className={block}>
        <h3 className="font-medium">{t("cookieChoices")}</h3>
        <CookiePreferencesButton label={t("editCookies")} className="mt-3 h-9 cursor-pointer rounded-md border border-line px-4 text-sm font-medium hover:bg-soft" />
      </div>
      <div className={block}>
        <h3 className="font-medium">{t("history")}</h3>
        <div className="mt-3">
          <HistoryControls enabled={!!profile?.historyEnabled} hasItems />
        </div>
      </div>
      <div className={block}>
        <h3 className="font-medium">{t("exportData")}</h3>
        <p className="mt-1 text-sm text-mute">{t("exportDataText")}</p>
        <a href="/api/account/export" download className="mt-3 inline-flex h-9 items-center rounded-md border border-line px-4 text-sm font-medium hover:bg-soft">
          {t("exportData")}
        </a>
      </div>
      <div>
        <h3 className="font-medium">{t("deleteAccount")}</h3>
        <p className="mt-1 text-sm text-mute">{t("deleteAccountText")}</p>
        <div className="mt-4">
          <DeleteAccountForm locale={locale} />
        </div>
      </div>
    </div>
  );
}
