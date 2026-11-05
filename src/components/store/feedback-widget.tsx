"use client";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleAlert, CircleCheck, MessageCircle, X } from "lucide-react";
import { submitFeedback } from "@/actions/store/feedback";
import { FEEDBACK_KINDS, FEEDBACK_MAX_MESSAGE, type FeedbackError, type FeedbackKind, type FeedbackResult } from "@/lib/domain/feedback";

const AUTH_COOKIE = /(?:^|;\s*)sb-[^=]+-auth-token/;
const ERROR_TEXT = { unauthenticated: "errorSession", invalid: "errorInvalid", rate_limited: "errorRate", server: "errorServer" } as const;

/** Anonymous visitors have no auth cookie, so they never download the Supabase client. */
async function hasSession(): Promise<boolean> {
  if (!AUTH_COOKIE.test(document.cookie)) return false;
  const { createBrowserSupabase } = await import("@/lib/supabase/browser");
  const { data } = await createBrowserSupabase().auth.getSession();
  return !!data.session;
}

/**
 * Checked in the browser so the store layout never reads the session. Signing in and out are
 * server actions that redirect without remounting the layout, hence the new check on each path.
 */
export function FeedbackWidget() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let stale = false;
    hasSession()
      .catch(() => false)
      .then((ok) => {
        if (!stale) setSignedIn(ok);
      });
    return () => {
      stale = true;
    };
  }, [pathname]);
  return signedIn ? <Balloon /> : null;
}

function Balloon() {
  const t = useTranslations("feedback");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<"sent" | FeedbackError | null>(null);
  const [pending, start] = useTransition();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) firstOptionRef.current?.focus();
  }, [open]);

  // the send button is disabled while sending, which drops focus: put it somewhere useful
  useEffect(() => {
    if (result === "sent") closeRef.current?.focus();
    else if (result) textRef.current?.focus();
  }, [result]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      setResult(null);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setResult(null);
    toggleRef.current?.focus();
  }

  function send(e: FormEvent) {
    e.preventDefault();
    if (!kind || !message.trim()) {
      setResult("invalid");
      return;
    }
    setResult(null);
    start(async () => {
      const r: FeedbackResult = await submitFeedback({ kind, message, page: window.location.pathname }).catch(() => ({ ok: false, error: "server" }));
      setResult(r.ok ? "sent" : r.error);
      if (r.ok) {
        setKind(null);
        setMessage("");
      }
    });
  }

  const panelId = `${id}-panel`;
  const titleId = `${id}-title`;
  // On phones the cookie banner leaves no room for the panel, so the balloon waits for that choice.
  return (
    <div className="fixed right-4 bottom-[calc(var(--cookie-banner-height,0px)+env(safe-area-inset-bottom,0px)+1rem)] z-40 max-md:[html:has([data-cookie-banner])_&]:hidden">
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          className="absolute right-0 bottom-full mb-3 max-h-[calc(100dvh-var(--cookie-banner-height,0px)-env(safe-area-inset-bottom,0px)-6rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-line bg-white p-4 shadow-[var(--shadow-pop)]"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-sm font-semibold">{t("title")}</h2>
            <button ref={closeRef} type="button" onClick={close} aria-label={t("close")} className="grid size-8 cursor-pointer place-items-center rounded-md hover:bg-soft">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <form onSubmit={send} className="mt-3 space-y-3">
            <fieldset className="space-y-1">
              <legend className="sr-only">{t("kindLegend")}</legend>
              {FEEDBACK_KINDS.map((k, i) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md py-1 text-sm">
                  <input ref={i === 0 ? firstOptionRef : undefined} type="radio" name={`${id}-kind`} required checked={kind === k} onChange={() => setKind(k)} className="size-4 accent-black" />
                  {t(k)}
                </label>
              ))}
            </fieldset>
            <div>
              <label htmlFor={`${id}-message`} className="field-label">{t("messageLabel")}</label>
              <textarea ref={textRef} id={`${id}-message`} rows={4} required maxLength={FEEDBACK_MAX_MESSAGE} value={message} onChange={(e) => setMessage(e.target.value)} aria-describedby={`${id}-hint`} className="field h-auto py-2" />
              <p id={`${id}-hint`} className="mt-1.5 flex justify-between gap-3 text-xs text-mute">
                <span>{t("privacyHint")}</span>
                <span className="shrink-0 tabular-nums">{message.length}/{FEEDBACK_MAX_MESSAGE}</span>
              </p>
            </div>
            <div role="status">
              {result === "sent" && <p className="flex items-start gap-1.5 text-sm font-medium"><CircleCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t("sent")}</p>}
              {result && result !== "sent" && <p className="flex items-start gap-1.5 text-sm font-medium"><CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t(ERROR_TEXT[result])}</p>}
            </div>
            <button type="submit" disabled={pending} className="btn btn-primary w-full">
              {pending ? t("sending") : t("send")}
            </button>
          </form>
        </div>
      )}
      <button
        ref={toggleRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? t("close") : t("open")}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="grid size-11 cursor-pointer place-items-center rounded-full bg-black text-white shadow-[var(--shadow-pop)] transition-colors duration-150 hover:bg-ink"
      >
        <MessageCircle className="size-5" aria-hidden />
      </button>
    </div>
  );
}
