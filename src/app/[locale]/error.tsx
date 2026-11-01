"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "store.render_error", digest: error.digest }));
  }, [error]);
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{t("errors.genericTitle")}</h1>
      <p className="text-mute">{t("errors.genericText")}</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={reset} className="h-10 cursor-pointer rounded-md bg-black px-5 text-sm font-medium text-white hover:bg-ink">{t("common.retry")}</button>
        <Link href="/" className="inline-flex h-10 items-center rounded-md border border-line px-5 text-sm font-medium hover:bg-soft">{t("common.backHome")}</Link>
      </div>
    </main>
  );
}
