"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CircleAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/admin/action-core";

export const inputCls = "field h-10 md:text-sm";
export const textareaCls = "field h-auto py-2";
export const btnPrimary = "btn btn-primary";
export const btnSecondary = "btn btn-secondary";

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="panel mb-4 grid gap-6 p-5 last:mb-0 md:p-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-mute">{description}</p>}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  );
}

export function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor?: string; error?: string | string[]; hint?: ReactNode; children: ReactNode }) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label">
        {label}
      </label>
      {children}
      {hint && !msg && <p className="mt-1.5 text-xs text-mute">{hint}</p>}
      {msg && (
        <p role="alert" className="field-error">
          <CircleAlert aria-hidden />
          {msg}
        </p>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 cursor-pointer rounded-full transition-colors duration-150 disabled:opacity-50 ${checked ? "bg-black" : "bg-line"}`}
      >
        <span className={`absolute left-0 top-0.5 size-5 rounded-full bg-white transition-transform duration-150 ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
      {label}
    </label>
  );
}

export const ERROR_TEXT: Record<string, string> = {
  forbidden: "Você não tem permissão para esta ação.",
  invalid: "Verifique os campos destacados.",
  conflict: "Conflito com dados existentes.",
  server: "Não foi possível salvar. Tente novamente.",
};

/** Run a server action from the client with toasts and a router refresh. */
export function useAdminAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run<O>(fn: () => Promise<ActionResult<O>>, opts: { success?: string; onSuccess?: (data: O) => void; onError?: (r: Extract<ActionResult<O>, { ok: false }>) => void } = {}) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (opts.success) toast.success(opts.success);
        opts.onSuccess?.(r.data);
        router.refresh();
      } else {
        toast.error(r.message ?? ERROR_TEXT[r.error] ?? ERROR_TEXT.server);
        opts.onError?.(r);
      }
    });
  }
  return { pending, run };
}

export function ConfirmButton({ label, title, description, confirmLabel = "Confirmar", onConfirm, className, disabled }: { label: ReactNode; title: string; description: string; confirmLabel?: string; onConfirm: () => void; className?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={className ?? btnSecondary}>
        {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel="Fechar" className="max-w-[calc(100%-2rem)] rounded-lg border border-line p-6 shadow-[var(--shadow-pop)] ring-0 sm:max-w-md">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-sm text-mute">{description}</DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
              className={btnPrimary}
            >
              {confirmLabel}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const LOCALE_TABS = [
  { code: "pt-BR", label: "Português (BR)" },
  { code: "pt-PT", label: "Português (PT)" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
] as const;
export type LocaleCode = (typeof LOCALE_TABS)[number]["code"];

export function LocaleTabs({ value, onChange, filled }: { value: LocaleCode; onChange: (l: LocaleCode) => void; filled: Partial<Record<LocaleCode, boolean>> }) {
  return (
    <div role="tablist" aria-label="Idioma" className="flex flex-wrap gap-1 border-b border-line">
      {LOCALE_TABS.map((t) => (
        <button
          key={t.code}
          type="button"
          role="tab"
          aria-selected={value === t.code}
          onClick={() => onChange(t.code)}
          className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm transition-colors duration-150 ${value === t.code ? "border-black font-medium" : "border-transparent text-mute hover:text-black"}`}
        >
          {t.label}
          {t.code === "pt-BR" ? " *" : filled[t.code] ? <Check className="ml-1 inline size-3.5" aria-label="preenchido" /> : ""}
        </button>
      ))}
    </div>
  );
}
