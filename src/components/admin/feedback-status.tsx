"use client";
import { setFeedbackStatus } from "@/actions/admin/feedback";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/domain/feedback";
import { FEEDBACK_STATUS_LABEL } from "./feedback-labels";
import { useAdminAction } from "./form";

export function FeedbackStatusSelect({ id, status }: { id: string; status: FeedbackStatus }) {
  const { pending, run } = useAdminAction();
  return (
    <select
      aria-label="Status"
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        run(() => setFeedbackStatus({ id, status: next }), { success: "Status atualizado." });
      }}
      className="field h-10 w-auto"
    >
      {FEEDBACK_STATUSES.map((s) => (
        <option key={s} value={s}>{FEEDBACK_STATUS_LABEL[s]}</option>
      ))}
    </select>
  );
}
