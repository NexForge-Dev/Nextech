import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { Link, redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { signUp } from "@/actions/store/auth";
import { AuthForm } from "@/components/store/auth-form";
import { AuthShell } from "@/components/store/auth-shell";

export const metadata = { robots: { index: false } };

export default async function SignUpPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ email?: string; motivo?: string }> }) {
  const locale = await pageLocale(params);
  if (await getSessionUser()) redirect({ href: "/minha-conta", locale });
  const t = await getTranslations("auth");
  const tf = await getTranslations("footer");
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email.slice(0, 254) : undefined;
  const noAccount = sp.motivo === "sem-conta";
  return (
    <AuthShell
      title={t("signUpTitle")}
      aside={
        <>
          {t("haveAccount")}{" "}
          <Link href="/entrar" className="font-medium text-black underline underline-offset-2">{t("signIn")}</Link>
        </>
      }
    >
      {noAccount && (
        <p role="status" className="mb-5 rounded-md bg-soft px-3 py-2 text-sm">
          {t("noAccountFound")}
        </p>
      )}
      <AuthForm
        action={signUp}
        locale={locale}
        submit={t("signUp")}
        fields={[
          { name: "fullName", label: t("fullName"), autoComplete: "name" },
          { name: "email", label: t("email"), type: "email", autoComplete: "email", defaultValue: email },
          { name: "password", label: t("password"), type: "password", autoComplete: "new-password" },
        ]}
        footer={
          <p className="text-xs text-mute">
            {t("termsNotice")} <Link href="/termos" className="underline">{tf("terms")}</Link> · <Link href="/privacidade" className="underline">{tf("privacy")}</Link>
          </p>
        }
      />
    </AuthShell>
  );
}
