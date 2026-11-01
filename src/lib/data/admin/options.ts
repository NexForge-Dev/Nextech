import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";

export async function getNetworkOptions() {
  const sb = await createServerSupabase();
  const { data } = await sb.from("affiliate_networks").select("id, name, adapter, price_display_policy, active").order("name");
  return (data ?? []).map((n) => ({ id: n.id, name: `${n.name}${n.active ? "" : " (inativa)"}`, adapter: n.adapter, policy: n.price_display_policy }));
}

export async function getMarketOptions() {
  const sb = await createServerSupabase();
  const { data } = await sb.from("markets").select("code, name_pt, active, default_currency").order("active", { ascending: false }).order("code");
  return (data ?? []).map((m) => ({ code: m.code, name: m.name_pt, active: m.active, currency: m.default_currency }));
}
