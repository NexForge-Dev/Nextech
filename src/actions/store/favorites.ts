"use server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { mergeFavorites } from "@/lib/domain/favorites-merge";

const uuid = z.string().uuid();

export async function toggleFavorite(productId: string): Promise<{ ok: boolean; favorited: boolean }> {
  const id = uuid.safeParse(productId);
  const user = await getSessionUser();
  if (!id.success || !user) return { ok: false, favorited: false };
  const sb = await createServerSupabase();
  const { data: existing } = await sb.from("favorites").select("id").eq("product_id", id.data).maybeSingle();
  if (existing) {
    const { error } = await sb.from("favorites").delete().eq("id", existing.id);
    return { ok: !error, favorited: !!error };
  }
  const { error } = await sb.from("favorites").insert({ user_id: user.id, product_id: id.data });
  return { ok: !error, favorited: !error };
}

/** Merge favorites saved in this browser into the account (called once after sign-in). */
export async function syncLocalFavorites(ids: string[]): Promise<{ ok: boolean; added: number }> {
  const user = await getSessionUser();
  if (!user || !Array.isArray(ids)) return { ok: false, added: 0 };
  const sb = await createServerSupabase();
  const { data } = await sb.from("favorites").select("product_id");
  const { toInsert } = mergeFavorites(ids, (data ?? []).map((r) => r.product_id));
  if (!toInsert.length) return { ok: true, added: 0 };
  // insert one by one: unpublished/removed products are rejected by RLS and skipped
  let added = 0;
  for (const product_id of toInsert) {
    const { error } = await sb.from("favorites").insert({ user_id: user.id, product_id });
    if (!error) added++;
  }
  return { ok: true, added };
}
