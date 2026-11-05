import "server-only";
import type { createServerSupabase } from "@/lib/supabase/server";
import { log } from "@/lib/log";

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

// Errors while migration 0029 is not applied yet: the store keeps selling, the date is just not kept.
const COLUMN_MISSING = new Set(["42703", "PGRST204"]);

export async function readBirthDate(sb: Supabase, userId: string): Promise<string | null> {
  const { data, error } = await sb.from("profiles").select("birth_date").eq("id", userId).maybeSingle();
  if (error && !COLUMN_MISSING.has(error.code)) log.error("profile.birth_date_read_failed", error);
  return error ? null : (data?.birth_date ?? null);
}

export async function saveBirthDate(sb: Supabase, userId: string, birthDate: string | null): Promise<boolean> {
  const { error } = await sb.from("profiles").update({ birth_date: birthDate }).eq("id", userId);
  if (!error) return true;
  if (COLUMN_MISSING.has(error.code)) {
    log.info("profile.birth_date_column_missing", {});
    return true;
  }
  log.error("profile.birth_date_save_failed", error);
  return false;
}
