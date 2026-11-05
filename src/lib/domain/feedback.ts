import { z } from "zod";

export const FEEDBACK_KINDS = ["suggestion", "problem"] as const;
export const FEEDBACK_STATUSES = ["new", "reviewing", "resolved"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_MAX_MESSAGE = 4000;
const MAX_PAGE = 300;

/** Query strings and fragments can hold tokens or e-mails, so only the path is ever kept. */
export function pathOnly(page: string): string {
  const path = page.split(/[?#]/, 1)[0];
  return path.startsWith("/") ? path.slice(0, MAX_PAGE) : "";
}

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(1).max(FEEDBACK_MAX_MESSAGE),
  page: z.string().default("").transform(pathOnly),
});

export type FeedbackError = "unauthenticated" | "invalid" | "rate_limited" | "server";
export type FeedbackResult = { ok: true } | { ok: false; error: FeedbackError };

export type FeedbackRow = { userId: string; kind: FeedbackKind; message: string; page: string };
/** Never add the author's name, e-mail or id here: this is what leaves for the NexForge panel. */
export type FeedbackForward = { externalId: string; kind: FeedbackKind; message: string; page: string; occurredAt: Date };

type Deps = {
  user: () => Promise<{ id: string } | null>;
  allow: (userId: string) => Promise<boolean>;
  /** Resolves to null when the row could not be saved. */
  save: (row: FeedbackRow) => Promise<{ id: string; createdAt: string } | null>;
  forward: (item: FeedbackForward) => Promise<void>;
  onForwardError: (err: unknown) => void;
};

/** Testable core of submitFeedback(): session → validation → limit → own database → NexForge. */
export async function submitFeedbackWith(deps: Deps, input: unknown): Promise<FeedbackResult> {
  const user = await deps.user();
  if (!user) return { ok: false, error: "unauthenticated" };
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!(await deps.allow(user.id))) return { ok: false, error: "rate_limited" };
  const { kind, message, page } = parsed.data;
  const saved = await deps.save({ userId: user.id, kind, message, page });
  if (!saved) return { ok: false, error: "server" };
  // saved is what counts for the customer: the panel only ever gets a copy
  try {
    await deps.forward({ externalId: saved.id, kind, message, page, occurredAt: new Date(saved.createdAt) });
  } catch (e) {
    deps.onForwardError(e);
  }
  return { ok: true };
}
