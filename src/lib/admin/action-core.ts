import type { ZodType } from "zod";
import type { AdminContext, Permission } from "@/lib/auth/permissions";

export type ActionError = "forbidden" | "invalid" | "conflict" | "server";
export type ActionResult<O> = { ok: true; data: O } | { ok: false; error: ActionError; message?: string; fieldErrors?: Record<string, string[]> };

export type AuditEntry = { actorId: string; action: string; entity: string; entityId?: string | null; summary?: Record<string, unknown> };

export class ActionFailure extends Error {
  constructor(
    public readonly error: ActionError,
    message?: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message ?? error);
  }
}

type Deps = { load: () => Promise<AdminContext | null>; audit: (e: AuditEntry) => Promise<void> };
type Opts<I> = { permission: Permission; schema: ZodType<I>; audit?: { action: string; entity: string } };

/** Testable core of adminAction(): permission → validation → fn → audit, with errors mapped. */
export function adminActionWith<I, O>(deps: Deps, opts: Opts<I>, fn: (input: I, ctx: AdminContext) => Promise<O>) {
  return async (input: unknown): Promise<ActionResult<O>> => {
    const ctx = await deps.load();
    if (!ctx || !ctx.permissions.has(opts.permission)) return { ok: false, error: "forbidden" };
    const parsed = opts.schema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return { ok: false, error: "invalid", fieldErrors };
    }
    try {
      const data = await fn(parsed.data, ctx);
      if (opts.audit) {
        const d = data as { id?: unknown; audit?: Record<string, unknown> } | undefined;
        await deps.audit({
          actorId: ctx.userId,
          action: opts.audit.action,
          entity: opts.audit.entity,
          entityId: typeof d?.id === "string" ? d.id : null,
          summary: d?.audit ?? {},
        });
      }
      return { ok: true, data };
    } catch (e) {
      if (e instanceof ActionFailure) return { ok: false, error: e.error, message: e.message, fieldErrors: e.fieldErrors };
      const code = (e as { code?: string })?.code;
      if (code === "23505") return { ok: false, error: "conflict", message: "Já existe um registro com esses dados (slug ou identificador duplicado)." };
      if (code === "23503") return { ok: false, error: "conflict", message: "Este registro está em uso por outros itens." };
      if (code === "42501") return { ok: false, error: "forbidden" };
      console.error(JSON.stringify({ level: "error", event: "admin.action_failed", action: opts.audit?.action, message: e instanceof Error ? e.message : String(e) }));
      return { ok: false, error: "server" };
    }
  };
}
