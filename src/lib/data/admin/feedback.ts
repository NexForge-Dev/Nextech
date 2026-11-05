import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import type { FeedbackKind, FeedbackStatus } from "@/lib/domain/feedback";

export type FeedbackListItem = { id: string; kind: FeedbackKind; message: string; page: string; status: FeedbackStatus; createdAt: string; email: string | null };

export const FEEDBACK_LIST_LIMIT = 200;

/** Latest messages. E-mails live in auth.users (service role), so callers must check customers.read first. */
export async function listFeedback(filters: { status?: FeedbackStatus; kind?: FeedbackKind }): Promise<FeedbackListItem[]> {
  const sb = await createServerSupabase();
  let q = sb.from("product_feedback").select("id, user_id, kind, message, page, status, created_at").order("created_at", { ascending: false }).limit(FEEDBACK_LIST_LIMIT);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.kind) q = q.eq("kind", filters.kind);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const svc = createServiceSupabase();
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const found = await Promise.all(ids.map((id) => svc.auth.admin.getUserById(id).then(({ data: u }) => [id, u.user?.email ?? null] as const)));
  const emails = new Map(found);
  return rows.map((r) => ({ id: r.id, kind: r.kind as FeedbackKind, message: r.message, page: r.page, status: r.status as FeedbackStatus, createdAt: r.created_at, email: emails.get(r.user_id) ?? null }));
}
