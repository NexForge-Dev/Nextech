"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { submitContact } from "@/actions/store/contact";
import { inputClass } from "./auth-form";
import { Notice } from "./ui";

export function ContactForm({ locale, ownStore = false }: { locale: string; ownStore?: boolean }) {
  const t = useTranslations("legal");
  const [state, action, pending] = useActionState(submitContact, null);
  if (state?.ok) {
    return (
      <Notice tone="success" className="mt-10">{t("contactSent")}</Notice>
    );
  }
  const label = "field-label";
  return (
    <form action={action} className="panel mt-10 space-y-5 p-5 md:p-6">
      <input type="hidden" name="locale" value={locale} />
      {/* honeypot: hidden from people, bots fill it */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="c-name" className={label}>{t("contactName")}</label>
          <input id="c-name" name="name" required maxLength={120} autoComplete="name" className={inputClass} />
        </div>
        <div>
          <label htmlFor="c-email" className={label}>{t("contactEmail")}</label>
          <input id="c-email" name="email" type="email" required maxLength={254} autoComplete="email" className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="c-subject" className={label}>{t("contactSubject")}</label>
        <input id="c-subject" name="subject" maxLength={160} className={inputClass} />
      </div>
      <div>
        <label htmlFor="c-body" className={label}>{t("contactBody")}</label>
        <textarea id="c-body" name="body" required minLength={10} maxLength={5000} rows={6} className={`${inputClass} h-auto py-2`} />
      </div>
      <p className="text-xs text-mute">{ownStore ? t("contactOrderNote") : t("contactPurchaseNote")}</p>
      {state?.error && (
        <Notice tone="error">{state.error}</Notice>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary h-11 px-6">
        {t("contactSend")}
      </button>
    </form>
  );
}
