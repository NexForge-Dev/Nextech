"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleAlert } from "lucide-react";
import { cancelMyOrder, myInvoiceUrl, requestReturn, type ReturnState } from "@/actions/store/orders";
import { inputClass } from "./auth-form";
import { Notice } from "./ui";

const btn = "btn btn-secondary";

export function OrderActions({ orderNumber, contactEmail, cancellable, canRequestReturn, hasInvoice }: { orderNumber: number; contactEmail: string; cancellable: boolean; canRequestReturn: boolean; hasInvoice: boolean }) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [pending, start] = useTransition();
  const [state, action, sending] = useActionState<ReturnState, FormData>(requestReturn, null);
  const noRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) noRef.current?.focus();
  }, [confirming]);

  async function openInvoice() {
    // navigate in this tab: a window.open after an await is blocked by Safari/iOS popup blockers
    const url = await myInvoiceUrl(orderNumber).catch(() => null);
    if (url) window.location.assign(url);
    else toast.error(t("invoiceError"));
  }

  function cancel() {
    start(async () => {
      const r = await cancelMyOrder(orderNumber);
      setConfirming(false);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.refund === "manual" ? t("cancelledManual", { contact: contactEmail }) : r.refund === "stripe" ? t("cancelledRefund") : t("cancelled"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {hasInvoice && (
          <button type="button" className={btn} onClick={openInvoice}>
            {t("invoice")}
          </button>
        )}
        {canRequestReturn && !state?.ok && (
          <button type="button" className={btn} onClick={() => setShowReturn((v) => !v)} aria-expanded={showReturn}>
            {t("support")}
          </button>
        )}
        {cancellable && !confirming && (
          <button type="button" className={btn} onClick={() => setConfirming(true)}>
            {t("cancel")}
          </button>
        )}
      </div>

      {confirming && (
        <div role="alertdialog" aria-label={t("cancel")} onKeyDown={(e) => e.key === "Escape" && setConfirming(false)} className="space-y-3 rounded-lg border border-black bg-white p-4">
          <p className="text-sm">{t("cancelConfirm")}</p>
          <div className="flex gap-3">
            <button type="button" disabled={pending} onClick={cancel} className="btn btn-primary">{t("cancelYes")}</button>
            <button ref={noRef} type="button" onClick={() => setConfirming(false)} className="btn btn-secondary">{t("cancelNo")}</button>
          </div>
        </div>
      )}

      {state?.ok && <Notice tone="success">{t("returnSent")}</Notice>}
      {showReturn && !state?.ok && (
        <form action={action} className="panel space-y-4 p-4" data-testid="return-form">
          <input type="hidden" name="number" value={orderNumber} />
          <div>
            <label htmlFor="rr-reason" className="field-label">{t("returnReason")}</label>
            <select id="rr-reason" name="reason" className={inputClass} defaultValue="defect">
              <option value="withdrawal">{t("reason_withdrawal")}</option>
              <option value="defect">{t("reason_defect")}</option>
              <option value="other">{t("reason_other")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="rr-message" className="field-label">{t("returnMessage")}</label>
            <textarea id="rr-message" name="message" rows={4} className={`${inputClass} h-auto py-2`} />
            {state?.fieldErrors?.message && <p role="alert" className="field-error"><CircleAlert aria-hidden />{state.fieldErrors.message[0]}</p>}
          </div>
          <div>
            <label htmlFor="rr-photos" className="field-label">{t("returnPhotos")}</label>
            <input id="rr-photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="text-sm" />
            {state?.fieldErrors?.photos && <p role="alert" className="field-error"><CircleAlert aria-hidden />{state.fieldErrors.photos[0]}</p>}
          </div>
          {state?.error && <Notice tone="error">{state.error}</Notice>}
          <button type="submit" disabled={sending} className="btn btn-primary">{t("returnSend")}</button>
        </form>
      )}
    </div>
  );
}
