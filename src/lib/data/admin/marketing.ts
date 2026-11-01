import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";

export async function productOptions() {
  const sb = await createServerSupabase();
  const { data } = await sb.from("product_translations").select("product_id, name, products!inner(status)").eq("locale", "pt-BR").neq("products.status", "archived").order("name").limit(2000);
  return (data ?? []).map((p) => ({ id: p.product_id, name: p.name }));
}

export async function campaignOptions() {
  const sb = await createServerSupabase();
  const { data } = await sb.from("campaigns").select("id, name").order("created_at", { ascending: false }).limit(200);
  return data ?? [];
}

export async function bannerOptions() {
  const sb = await createServerSupabase();
  const { data } = await sb.from("banners").select("id, banner_translations(locale, title)").order("sort_order").limit(200);
  return (data ?? []).map((b) => ({ id: b.id, name: b.banner_translations.find((t) => t.locale === "pt-BR")?.title ?? "Banner sem título" }));
}

export function scheduleLabel(active: boolean, startsAt: string | null, endsAt: string | null, publishAt?: string | null, now = new Date()): string {
  if (!active) return "Inativa";
  if (endsAt && new Date(endsAt) <= now) return "Encerrada";
  if ((startsAt && new Date(startsAt) > now) || (publishAt && new Date(publishAt) > now)) return "Agendada";
  return "Ativa";
}
