"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { clearLocalFavorites, getLocalFavorites } from "@/lib/favorites-local";
import { syncLocalFavorites } from "@/actions/store/favorites";
import { clearHistory, deleteAccount, dismissHistoryPrompt, setHistoryEnabled } from "@/actions/store/account";
import { inputClass } from "./auth-form";

/** After sign-in, move favourites saved in this browser into the account (once). */
export function FavoritesSync() {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const ids = getLocalFavorites();
    if (!ids.length) return;
    syncLocalFavorites(ids).then((r) => {
      if (r.ok) {
        clearLocalFavorites();
        if (r.added) router.refresh();
      }
    });
  }, [router]);
  return null;
}

export function HistoryPrompt() {
  const t = useTranslations("account");
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();
  if (hidden) return null;
  return (
    <div className="mb-8 rounded-md border border-line p-5">
      <p className="font-medium">{t("historyPromptTitle")}</p>
      <p className="mt-1 text-sm text-mute">{t("historyPromptText")}</p>
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={pending} onClick={() => start(async () => { await setHistoryEnabled(true); setHidden(true); router.refresh(); })} className="h-9 cursor-pointer rounded-md bg-black px-4 text-sm font-medium text-white hover:bg-ink">
          {t("historyPromptYes")}
        </button>
        <button type="button" disabled={pending} onClick={() => start(async () => { await dismissHistoryPrompt(); setHidden(true); })} className="h-9 cursor-pointer rounded-md border border-line px-4 text-sm font-medium hover:bg-soft">
          {t("historyPromptNo")}
        </button>
      </div>
    </div>
  );
}

export function HistoryControls({ enabled, hasItems }: { enabled: boolean; hasItems: boolean }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-mute">{enabled ? t("historyOn") : t("historyOff")}</p>
      <button type="button" disabled={pending} onClick={() => start(async () => { await setHistoryEnabled(!enabled); router.refresh(); })} className="h-9 cursor-pointer rounded-md border border-line px-4 text-sm font-medium hover:bg-soft">
        {enabled ? t("pauseHistory") : t("enableHistory")}
      </button>
      {hasItems && (
        <button type="button" disabled={pending} onClick={() => start(async () => { await clearHistory(); setMsg(t("historyCleared")); router.refresh(); })} className="h-9 cursor-pointer rounded-md border border-black px-4 text-sm font-medium hover:bg-soft">
          {t("clearHistory")}
        </button>
      )}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}

export function DeleteAccountForm({ locale }: { locale: string }) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(deleteAccount, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor="confirm" className="block text-sm font-medium">{t("deleteConfirmLabel")}</label>
      <input id="confirm" name="confirm" autoComplete="off" className={`${inputClass} max-w-xs`} aria-invalid={!!state?.fieldErrors?.confirm} />
      {state?.error && <p role="alert" className="text-sm font-medium">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className="h-10 cursor-pointer rounded-md border border-black bg-white px-4 text-sm font-semibold text-black transition-colors duration-150 hover:bg-black hover:text-white disabled:opacity-60">
          {t("deleteAccount")}
        </button>
      </div>
    </form>
  );
}

export function GuestFavoritesLoader({ hasIds }: { hasIds: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (hasIds) return;
    const ids = getLocalFavorites();
    if (ids.length) router.replace(`?ids=${ids.join(",")}`);
  }, [hasIds, router]);
  return null;
}
