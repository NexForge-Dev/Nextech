"use server";
import { forwardFeedback } from "@/lib/analytics";
import { getSessionUser } from "@/lib/auth/session";
import { submitFeedbackWith, type FeedbackResult, type FeedbackRow } from "@/lib/domain/feedback";
import { log } from "@/lib/log";
import { rateLimit } from "@/lib/security/rate-limit";
import { createServiceSupabase } from "@/lib/supabase/service";

async function save(row: FeedbackRow) {
  try {
    const { data, error } = await createServiceSupabase()
      .from("product_feedback")
      .insert({ user_id: row.userId, kind: row.kind, message: row.message, page: row.page })
      .select("id, created_at")
      .single();
    if (error) throw error;
    return { id: data.id, createdAt: data.created_at };
  } catch (e) {
    log.error("feedback.save_failed", e);
    return null;
  }
}

/** Balloon in the store. The author always comes from the session, never from the client. */
export async function submitFeedback(input: unknown): Promise<FeedbackResult> {
  return submitFeedbackWith(
    {
      user: getSessionUser,
      allow: (userId) => rateLimit("feedback", `user:${userId}`),
      save,
      forward: forwardFeedback,
      onForwardError: (e) => log.error("feedback.forward_failed", e),
    },
    input,
  );
}
