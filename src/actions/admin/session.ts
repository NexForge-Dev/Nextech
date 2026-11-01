"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { safeNextPath } from "@/lib/domain/safe-next";

export type AdminLoginState = { error?: string } | null;

export async function adminSignIn(_: AdminLoginState, form: FormData): Promise<AdminLoginState> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(72) }).safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Informe e-mail e senha válidos." };
  if (!(await rateLimit("auth"))) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  const sb = await createServerSupabase();
  const { error } = await sb.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos." };
  const next = safeNextPath(String(form.get("next") ?? ""));
  redirect(next && next.startsWith("/admin") ? next : "/admin");
}

export async function adminSignOut() {
  const sb = await createServerSupabase();
  await sb.auth.signOut();
  redirect("/admin/entrar");
}
