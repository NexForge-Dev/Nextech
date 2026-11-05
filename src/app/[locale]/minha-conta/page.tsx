import { getFormatter, getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { getSessionUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/data/account";
import { getMyBirthDate } from "@/actions/store/checkout";
import { updateProfile } from "@/actions/store/account";
import { updatePassword } from "@/actions/store/auth";
import { AuthForm } from "@/components/store/auth-form";

export const metadata = { robots: { index: false } };

export default async function AccountInfoPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params);
  const user = await getSessionUser();
  // the layout redirects guests; pages render in parallel, so bail out quietly
  if (!user) return null;
  const [t, ta, format, profile, birthDate] = await Promise.all([getTranslations("account"), getTranslations("auth"), getFormatter(), getProfile(user.id), getMyBirthDate()]);
  return (
    <div className="max-w-2xl space-y-4">
      <div className="panel p-5 md:p-6">
        <h2 className="t-section">{t("info")}</h2>
        {profile && <p className="mt-1 text-sm text-mute">{t("memberSince", { date: format.dateTime(new Date(profile.createdAt), { dateStyle: "long" }) })}</p>}
        <dl className="mt-6 text-sm">
          <dt className="text-mute">{t("email")}</dt>
          <dd className="mt-1">{user.email}</dd>
        </dl>
        <div className="mt-6">
          <AuthForm action={updateProfile} locale={locale} submit={t("saveProfile")} fields={[{ name: "fullName", label: t("name"), autoComplete: "name", defaultValue: profile?.fullName ?? "" }, { name: "birthDate", label: t("birthDate"), type: "date", autoComplete: "bday", required: false, defaultValue: birthDate ?? "" }]} />
        </div>
      </div>
      <div className="panel p-5 md:p-6">
        <h2 className="t-section">{t("changePassword")}</h2>
        <div className="mt-6">
          <AuthForm action={updatePassword} locale={locale} submit={ta("updatePassword")} fields={[{ name: "password", label: t("newPassword"), type: "password", autoComplete: "new-password" }]} />
        </div>
      </div>
    </div>
  );
}
