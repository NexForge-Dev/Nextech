"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setPreferences } from "@/actions/store/account";

type Opt = { value: string; label: string };

export function PreferencesForm({ locale, languages, markets, current }: { locale: string; languages: Opt[]; markets: Opt[]; current: { locale: string; market: string } }) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(setPreferences, null);
  const select = "h-11 w-full cursor-pointer rounded-md border border-line bg-white px-3 text-[15px] outline-none focus:border-black";
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label htmlFor="p-locale" className="mb-1.5 block text-sm font-medium">
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
          <label htmlFor="p-market" className="mb-1.5 block text-sm font-medium">
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
        <p role="status" className="text-sm">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="h-11 cursor-pointer rounded-md bg-black px-6 text-sm font-semibold text-white hover:bg-ink disabled:opacity-60">
        {tc("save")}
      </button>
    </form>
  );
}
