"use server";
import { getTranslations } from "next-intl/server";
import { isLocale } from "@/i18n/routing";
import { classifyContact, contactSchema } from "@/lib/domain/contact";
import { rateLimit } from "@/lib/security/rate-limit";
import { createServiceSupabase } from "@/lib/supabase/service";

export type ContactState = { ok?: boolean; error?: string } | null;

export async function submitContact(_: ContactState, form: FormData): Promise<ContactState> {
  const rawLocale = String(form.get("locale") ?? "");
  const locale = isLocale(rawLocale) ? rawLocale : "pt-BR";
  const t = await getTranslations({ locale, namespace: "legal" });
  const ta = await getTranslations({ locale, namespace: "auth" });
  const input = {
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    subject: String(form.get("subject") ?? ""),
    body: String(form.get("body") ?? ""),
    website: String(form.get("website") ?? ""),
  };
  const verdict = classifyContact(input);
  if (!verdict.ok) return { error: t("contactError") };
  if (!verdict.store) return { ok: true };
  if (!(await rateLimit("contact"))) return { error: ta("tooMany") };
  const data = contactSchema.parse(input);
  const { error } = await createServiceSupabase()
    .from("contact_messages")
    .insert({ name: data.name, email: data.email, subject: data.subject || null, body: data.body, locale });
  if (error) return { error: t("contactError") };
  return { ok: true };
}
