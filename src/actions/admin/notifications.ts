"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth/session";

export async function markNotificationsRead(keys: string[]): Promise<{ ok: boolean }> {
  const ctx = await getAdminContext();
  const parsed = z.array(z.string().min(1).max(200)).max(100).safeParse(keys);
  if (!ctx || !parsed.success || !parsed.data.length) return { ok: false };
  const sb = await createServerSupabase();
  const { error } = await sb
    .from("admin_notification_reads")
    .upsert(parsed.data.map((k) => ({ user_id: ctx.userId, notification_key: k })), { onConflict: "user_id,notification_key", ignoreDuplicates: true });
  revalidatePath("/admin", "layout");
  return { ok: !error };
}
