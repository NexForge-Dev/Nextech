"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { getPathname } from "@/i18n/navigation";
import { isLocale, LOCALES, type Locale } from "@/i18n/routing";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getSessionUser } from "@/lib/auth/session";
import { MARKET_COOKIE } from "@/lib/domain/markets";
import { getAvailableMarkets } from "@/lib/data/taxonomy";
import type { AuthState } from "./auth";

function localeOf(form: FormData): Locale {
  const l = String(form.get("locale") ?? "");
  return isLocale(l) ? l : "pt-BR";
}

export async function updateProfile(_: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const t = await getTranslations({ locale, namespace: "account" });
  const ta = await getTranslations({ locale, namespace: "auth" });
  const user = await getSessionUser();
  if (!user) return { error: ta("genericError") };
  const name = z.string().trim().min(1).max(120).safeParse(form.get("fullName"));
  if (!name.success) return { fieldErrors: { fullName: ta("nameRequired") } };
  const sb = await createServerSupabase();
  const { error } = await sb.from("profiles").update({ full_name: name.data }).eq("id", user.id);
  if (error) return { error: ta("genericError") };
  revalidatePath("/", "layout");
  return { message: t("saved") };
}

export async function setPreferences(_: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const t = await getTranslations({ locale, namespace: "account" });
  const user = await getSessionUser();
  if (!user) return null;
  const prefLocale = String(form.get("preferredLocale") ?? "");
  const market = String(form.get("preferredMarket") ?? "").toUpperCase();
  const markets = (await getAvailableMarkets()).map((m) => m.code);
  const sb = await createServerSupabase();
  await sb
    .from("profiles")
    .update({ preferred_locale: (LOCALES as readonly string[]).includes(prefLocale) ? prefLocale : null, preferred_market: markets.includes(market) ? market : null })
    .eq("id", user.id);
  if (markets.includes(market)) {
    (await cookies()).set(MARKET_COOKIE, market, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  }
  if (isLocale(prefLocale) && prefLocale !== locale) redirect(getPathname({ locale: prefLocale, href: "/minha-conta/preferencias" }));
  revalidatePath("/", "layout");
  return { message: t("saved") };
}

export async function setHistoryEnabled(enabled: boolean): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };
  const sb = await createServerSupabase();
  const { data: profile } = await sb.from("profiles").select("consent").eq("id", user.id).single();
  const consent = { ...((profile?.consent as Record<string, unknown>) ?? {}), history_prompted: true, history_decided_at: new Date().toISOString() };
  const { error } = await sb.from("profiles").update({ history_enabled: !!enabled, consent }).eq("id", user.id);
  revalidatePath("/", "layout");
  return { ok: !error };
}

export async function dismissHistoryPrompt(): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const sb = await createServerSupabase();
  const { data: profile } = await sb.from("profiles").select("consent").eq("id", user.id).single();
  await sb.from("profiles").update({ consent: { ...((profile?.consent as Record<string, unknown>) ?? {}), history_prompted: true } }).eq("id", user.id);
  revalidatePath("/", "layout");
}

export async function clearHistory(): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };
  const sb = await createServerSupabase();
  const { error } = await sb.from("browsing_history").delete().eq("user_id", user.id);
  revalidatePath("/", "layout");
  return { ok: !error };
}

export async function deleteAccount(_: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const t = await getTranslations({ locale, namespace: "account" });
  const ta = await getTranslations({ locale, namespace: "auth" });
  const user = await getSessionUser();
  if (!user) return { error: ta("genericError") };
  if (String(form.get("confirm") ?? "").trim() !== t("deleteConfirmWord")) return { fieldErrors: { confirm: t("deleteConfirmLabel") } };
  const sb = await createServerSupabase();
  await sb.auth.signOut();
  // service role: deleting the auth user cascades profile, favorites, history; searches keep no user id
  const { error } = await createServiceSupabase().auth.admin.deleteUser(user.id);
  if (error) return { error: ta("genericError") };
  redirect(getPathname({ locale, href: "/" }));
}
