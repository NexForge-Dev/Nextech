import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { Link } from "@/i18n/navigation";
import { requestPasswordReset } from "@/actions/store/auth";
import { AuthForm } from "@/components/store/auth-form";
import { AuthShell } from "@/components/store/auth-shell";

export const metadata = { robots: { index: false } };

export default async function ForgotPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params);
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("forgotTitle")} aside={<Link href="/entrar" className="font-medium text-black underline underline-offset-2">{t("signIn")}</Link>}>
      <AuthForm action={requestPasswordReset} locale={locale} submit={t("sendLink")} fields={[{ name: "email", label: t("email"), type: "email", autoComplete: "email" }]} />
    </AuthShell>
  );
}
