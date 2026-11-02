"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelMyOrder, myInvoiceUrl, requestReturn, type ReturnState } from "@/actions/store/orders";
import { inputClass } from "./auth-form";

const btn = "inline-flex h-11 cursor-pointer items-center rounded-md border border-black px-5 text-sm font-semibold hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50";

export function OrderActions({ orderNumber, cancellable, canRequestReturn, hasInvoice }: { orderNumber: number; cancellable: boolean; canRequestReturn: boolean; hasInvoice: boolean }) {
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
      toast.success(r.refund === "manual" ? t("cancelledManual") : t("cancelled"));
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
        <div role="alertdialog" aria-label={t("cancel")} onKeyDown={(e) => e.key === "Escape" && setConfirming(false)} className="space-y-3 rounded-md border border-black p-4">
          <p className="text-sm">{t("cancelConfirm")}</p>
          <div className="flex gap-3">
            <button type="button" disabled={pending} onClick={cancel} className="inline-flex h-10 cursor-pointer items-center rounded-md bg-black px-4 text-sm font-semibold text-white hover:bg-ink disabled:opacity-50">{t("cancelYes")}</button>
            <button ref={noRef} type="button" onClick={() => setConfirming(false)} className="inline-flex h-10 cursor-pointer items-center rounded-md border border-line px-4 text-sm">{t("cancelNo")}</button>
          </div>
        </div>
      )}

      {state?.ok && <p role="status" className="rounded-md bg-soft px-4 py-3 text-sm">{t("returnSent")}</p>}
      {showReturn && !state?.ok && (
        <form action={action} className="space-y-4 rounded-md border border-line p-4" data-testid="return-form">
          <input type="hidden" name="number" value={orderNumber} />
          <div>
            <label htmlFor="rr-reason" className="mb-1.5 block text-sm font-medium">{t("returnReason")}</label>
            <select id="rr-reason" name="reason" className={inputClass} defaultValue="defect">
              <option value="withdrawal">{t("reason_withdrawal")}</option>
              <option value="defect">{t("reason_defect")}</option>
              <option value="other">{t("reason_other")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="rr-message" className="mb-1.5 block text-sm font-medium">{t("returnMessage")}</label>
            <textarea id="rr-message" name="message" rows={4} className={`${inputClass} h-auto py-2`} />
            {state?.fieldErrors?.message && <p role="alert" className="mt-1 text-sm font-medium">⚠ {state.fieldErrors.message[0]}</p>}
          </div>
          <div>
            <label htmlFor="rr-photos" className="mb-1.5 block text-sm font-medium">{t("returnPhotos")}</label>
            <input id="rr-photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="text-sm" />
            {state?.fieldErrors?.photos && <p role="alert" className="mt-1 text-sm font-medium">⚠ {state.fieldErrors.photos[0]}</p>}
          </div>
          {state?.error && <p role="alert" className="text-sm font-medium">⚠ {state.error}</p>}
          <button type="submit" disabled={sending} className="inline-flex h-10 cursor-pointer items-center rounded-md bg-black px-4 text-sm font-semibold text-white hover:bg-ink disabled:opacity-50">{t("returnSend")}</button>
        </form>
      )}
    </div>
  );
}
