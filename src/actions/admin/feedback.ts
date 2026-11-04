"use server";
import { z } from "zod";
import { adminAction } from "@/lib/admin/action";
import { FEEDBACK_STATUSES } from "@/lib/domain/feedback";
import { createServerSupabase } from "@/lib/supabase/server";

const statusImpl = adminAction({ permission: "customers.read", schema: z.object({ id: z.string().uuid(), status: z.enum(FEEDBACK_STATUSES) }), audit: { action: "status", entity: "product_feedback" } }, async ({ id, status }) => {
  const sb = await createServerSupabase();
  const { error } = await sb.from("product_feedback").update({ status }).eq("id", id);
  if (error) throw error;
  return { id, audit: { status } };
});
export async function setFeedbackStatus(input: unknown) {
  return statusImpl(input);
}
