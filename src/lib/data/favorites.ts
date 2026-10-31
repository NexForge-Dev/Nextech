import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

/** Product ids favorited by the signed-in user (empty for guests — they use local storage). */
export async function getFavoriteIds(): Promise<Set<string>> {
  const user = await getSessionUser();
  if (!user) return new Set();
  const sb = await createServerSupabase();
  const { data } = await sb.from("favorites").select("product_id");
  return new Set((data ?? []).map((r) => r.product_id));
}
