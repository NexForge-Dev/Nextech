"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setPreferences } from "@/actions/store/account";
import { Notice } from "./ui";

type Opt = { value: string; label: string };

export function PreferencesForm({ locale, languages, markets, current }: { locale: string; languages: Opt[]; markets: Opt[]; current: { locale: string; market: string } }) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(setPreferences, null);
  const select = "field cursor-pointer";
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label htmlFor="p-locale" className="field-label">
          {t("language")}
        </label>
        <select id="p-locale" name="preferredLocale" defaultValue={current.locale} className={select}>
          {languages.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      {markets.length > 0 && (
        <div>
          <label htmlFor="p-market" className="field-label">
            {t("country")}
          </label>
          <select id="p-market" name="preferredMarket" defaultValue={current.market} className={select}>
            {markets.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {state?.message && (
        <Notice tone="success">{state.message}</Notice>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary h-11 px-6">
        {tc("save")}
      </button>
    </form>
  );
}
