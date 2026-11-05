import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { Link, redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/domain/safe-next";
import { signIn } from "@/actions/store/auth";
import { AuthForm } from "@/components/store/auth-form";
import { AuthShell } from "@/components/store/auth-shell";

export const metadata = { robots: { index: false } };

export default async function SignInPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const locale = await pageLocale(params);
  if (await getSessionUser()) redirect({ href: "/minha-conta", locale });
  const t = await getTranslations("auth");
  const next = safeNextPath((await searchParams).next) ?? "";
  return (
    <AuthShell
      title={t("signInTitle")}
      aside={
        <>
          {t("noAccount")}{" "}
          <Link href="/cadastro" className="inline-flex min-h-11 items-center font-medium text-black underline underline-offset-2 md:min-h-0">{t("signUp")}</Link>
          <p className="mt-2">{t("guestNote")}</p>
        </>
      }
    >
      <AuthForm
        action={signIn}
        locale={locale}
        hidden={{ next }}
        submit={t("signIn")}
        fields={[
          { name: "email", label: t("email"), type: "email", autoComplete: "email" },
          { name: "password", label: t("password"), type: "password", autoComplete: "current-password" },
        ]}
        footer={<Link href="/recuperar-senha" className="block text-center text-sm text-mute underline-offset-4 hover:text-black hover:underline">{t("forgot")}</Link>}
      />
    </AuthShell>
  );
}
