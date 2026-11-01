import "server-only";
import { getAdminContext } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/service";
import { adminActionWith, type AuditEntry } from "./action-core";

export { ActionFailure, type ActionResult } from "./action-core";

export async function writeAudit(e: AuditEntry): Promise<void> {
  const { error } = await createServiceSupabase()
    .from("admin_audit_log")
    .insert({ actor_id: e.actorId, action: e.action, entity: e.entity, entity_id: e.entityId ?? null, summary: (e.summary ?? {}) as never });
  if (error) console.error(JSON.stringify({ level: "error", event: "audit.write_failed", message: error.message }));
}

/** Server-action wrapper: permission + zod validation + audit log + error mapping. */
export function adminAction<I, O>(opts: Parameters<typeof adminActionWith<I, O>>[1], fn: Parameters<typeof adminActionWith<I, O>>[2]) {
  return adminActionWith<I, O>({ load: getAdminContext, audit: writeAudit }, opts, fn);
}
