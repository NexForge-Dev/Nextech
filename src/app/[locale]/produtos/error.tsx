"use client";
import { useTranslations } from "next-intl";

export default function CatalogError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("errorTitle")}</h1>
      <p className="mt-2 text-mute">{t("errorText")}</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-8">
        {tc("retry")}
      </button>
    </main>
  );
}
