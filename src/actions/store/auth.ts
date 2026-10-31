"use server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { getPathname } from "@/i18n/navigation";
import { isLocale, type Locale } from "@/i18n/routing";
import { createServerSupabase } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { safeNextPath } from "@/lib/domain/safe-next";

export type AuthState = { error?: string; message?: string; fieldErrors?: Record<string, string> } | null;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3300";

function localeOf(form: FormData): Locale {
  const l = String(form.get("locale") ?? "");
  return isLocale(l) ? l : "pt-BR";
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const t = await getTranslations({ locale, namespace: "auth" });
  const parsed = z
    .object({ fullName: z.string().trim().min(1).max(120), email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(8).max(72) })
    .safeParse({ fullName: form.get("fullName"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return { fieldErrors: { ...(f.fullName && { fullName: t("nameRequired") }), ...(f.email && { email: t("invalidEmail") }), ...(f.password && { password: t("passwordMin") }) } };
  }
  if (!(await rateLimit("auth"))) return { error: t("tooMany") };
  const sb = await createServerSupabase();
  const account = getPathname({ locale, href: "/minha-conta" });
  const { data, error } = await sb.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName, locale }, emailRedirectTo: `${SITE}/auth/callback?next=${encodeURIComponent(account)}` },
  });
  if (error) return { error: /registered|exists/i.test(error.message) ? t("emailTaken") : t("genericError") };
  if (!data.session) return { message: t("checkEmail") };
  redirect(account);
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const t = await getTranslations({ locale, namespace: "auth" });
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(72) }).safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: t("invalidCredentials") };
  if (!(await rateLimit("auth"))) return { error: t("tooMany") };
  const sb = await createServerSupabase();
  const { error } = await sb.auth.signInWithPassword(parsed.data);
  if (error) return { error: t("invalidCredentials") };
  redirect(safeNextPath(String(form.get("next") ?? "")) ?? getPathname({ locale, href: "/minha-conta" }));
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const t = await getTranslations({ locale, namespace: "auth" });
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!email.success) return { fieldErrors: { email: t("invalidEmail") } };
  if (!(await rateLimit("auth"))) return { error: t("tooMany") };
  const sb = await createServerSupabase();
  const reset = getPathname({ locale, href: "/redefinir-senha" });
  await sb.auth.resetPasswordForEmail(email.data, { redirectTo: `${SITE}/auth/callback?next=${encodeURIComponent(reset)}` });
  // same answer whether or not the account exists (no account enumeration)
  return { message: t("linkSent") };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const t = await getTranslations({ locale, namespace: "auth" });
  const ta = await getTranslations({ locale, namespace: "account" });
  const pw = z.string().min(8).max(72).safeParse(form.get("password"));
  if (!pw.success) return { fieldErrors: { password: t("passwordMin") } };
  const sb = await createServerSupabase();
  const { error } = await sb.auth.updateUser({ password: pw.data });
  if (error) return { error: t("genericError") };
  return { message: ta("passwordUpdated") };
}

export async function signOut(form: FormData) {
  const locale = localeOf(form);
  const sb = await createServerSupabase();
  await sb.auth.signOut();
  redirect(getPathname({ locale, href: "/" }));
}
