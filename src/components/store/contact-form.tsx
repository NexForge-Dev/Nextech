"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { submitContact } from "@/actions/store/contact";
import { inputClass } from "./auth-form";

export function ContactForm({ locale }: { locale: string }) {
  const t = useTranslations("legal");
  const [state, action, pending] = useActionState(submitContact, null);
  if (state?.ok) {
    return (
      <p role="status" className="mt-10 rounded-md bg-soft px-4 py-3 text-sm">
        {t("contactSent")}
      </p>
    );
  }
  const label = "mb-1.5 block text-sm font-medium";
  return (
    <form action={action} className="mt-10 space-y-5">
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
        <textarea id="c-body" name="body" required minLength={10} maxLength={5000} rows={6} className="w-full rounded-md border border-line bg-white px-3 py-2 text-[15px] outline-none focus:border-black" />
      </div>
      <p className="text-xs text-mute">{t("contactPurchaseNote")}</p>
      {state?.error && (
        <p role="alert" className="rounded-md border border-ink px-3 py-2 text-sm font-medium">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="h-11 cursor-pointer rounded-md bg-black px-6 text-sm font-semibold text-white hover:bg-ink disabled:opacity-60">
        {t("contactSend")}
      </button>
    </form>
  );
}
