import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { updatePassword } from "@/actions/store/auth";
import { AuthForm } from "@/components/store/auth-form";
import { AuthShell } from "@/components/store/auth-shell";

export const metadata = { robots: { index: false } };

export default async function ResetPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params);
  const t = await getTranslations("auth");
  const user = await getSessionUser();
  return (
    <AuthShell title={t("resetTitle")}>
      {user ? (
        <AuthForm action={updatePassword} locale={locale} submit={t("updatePassword")} fields={[{ name: "password", label: t("password"), type: "password", autoComplete: "new-password" }]} />
      ) : (
        <p className="text-sm text-mute">
          {t("genericError")} <Link href="/recuperar-senha" className="font-medium text-black underline">{t("forgot")}</Link>
        </p>
      )}
    </AuthShell>
  );
}
