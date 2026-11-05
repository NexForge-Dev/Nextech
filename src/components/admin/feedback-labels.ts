import type { FeedbackKind, FeedbackStatus } from "@/lib/domain/feedback";

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = { new: "Novo", reviewing: "Em análise", resolved: "Resolvido" };
export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = { suggestion: "Sugestão", problem: "Problema" };
