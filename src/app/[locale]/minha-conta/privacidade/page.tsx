import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { getSessionUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/data/account";
import { CookiePreferencesButton } from "@/components/store/cookie-banner";
import { getMyAddresses } from "@/actions/store/checkout";
import { DeleteAccountForm, HistoryControls, SavedAddresses } from "@/components/store/account-client";

export const metadata = { robots: { index: false } };

/** Only the middle digits ever reach the browser: ***.982.247-** */
function maskCpf(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : "***";
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params);
  const user = await getSessionUser();
  // the layout redirects guests; pages render in parallel, so bail out quietly
  if (!user) return null;
  const [t, profile, addresses] = await Promise.all([getTranslations("account"), getProfile(user.id), getMyAddresses()]);
  const block = "panel p-5 md:p-6";
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="t-section">{t("privacy")}</h2>
      <div className={block}>
        <h3 className="font-medium">{t("cookieChoices")}</h3>
        <CookiePreferencesButton label={t("editCookies")} className="btn btn-secondary mt-3" />
      </div>
      <div className={block}>
        <h3 className="font-medium">{t("history")}</h3>
        <div className="mt-3">
          <HistoryControls enabled={!!profile?.historyEnabled} hasItems />
        </div>
      </div>
      <div className={block}>
        <h3 className="font-medium">{t("savedAddresses")}</h3>
        <SavedAddresses
          addresses={addresses.map((a) => ({
            id: a.id,
            name: a.recipientName,
            line: `${a.street}, ${a.number}${a.complement ? ` – ${a.complement}` : ""} · ${a.city}/${a.state}`,
            cpf: maskCpf(a.cpf),
          }))}
        />
      </div>
      <div className={block}>
        <h3 className="font-medium">{t("exportData")}</h3>
        <p className="mt-1 text-sm text-mute">{t("exportDataText")}</p>
        <a href="/api/account/export" download className="btn btn-secondary mt-3">
          {t("exportData")}
        </a>
      </div>
      <div className="panel border-black p-5 md:p-6">
        <h3 className="font-medium">{t("deleteAccount")}</h3>
        <p className="mt-1 text-sm text-mute">{t("deleteAccountText")}</p>
        <div className="mt-4">
          <DeleteAccountForm locale={locale} />
        </div>
      </div>
    </div>
  );
}
