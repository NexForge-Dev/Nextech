"use client";
import { useActionState, useState, type ReactNode } from "react";
import type { AuthState } from "@/actions/store/auth";

type Field = { name: string; label: string; type?: string; autoComplete?: string; defaultValue?: string; required?: boolean };

export const inputClass = "h-11 w-full rounded-md border border-line bg-white px-3 text-[15px] outline-none transition-colors duration-150 focus:border-black aria-invalid:border-ink";

export function AuthForm({
  action,
  fields,
  submit,
  locale,
  hidden,
  footer,
}: {
  action: (s: AuthState, f: FormData) => Promise<AuthState>;
  fields: Field[];
  submit: string;
  locale: string;
  hidden?: Record<string, string>;
  footer?: ReactNode;
}) {
  // React resets the form after an action; feed the submitted values back as defaults so a
  // failed attempt does not wipe what the user typed (passwords are never kept)
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState(async (s: AuthState, fd: FormData) => {
    setValues(Object.fromEntries(fields.filter((f) => f.type !== "password").map((f) => [f.name, String(fd.get(f.name) ?? "")])));
    return action(s, fd);
  }, null);
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {fields.map((f) => {
        const err = state?.fieldErrors?.[f.name];
        return (
          <div key={f.name}>
            <label htmlFor={`f-${f.name}`} className="mb-1.5 block text-sm font-medium">
              {f.label}
            </label>
            <input
              id={`f-${f.name}`}
              name={f.name}
              type={f.type ?? "text"}
              autoComplete={f.autoComplete}
              defaultValue={values[f.name] ?? f.defaultValue}
              required={f.required ?? true}
              aria-invalid={!!err}
              aria-describedby={err ? `e-${f.name}` : undefined}
              className={inputClass}
            />
            {err && (
              <p id={`e-${f.name}`} className="mt-1.5 text-sm font-medium text-ink">
                {err}
              </p>
            )}
          </div>
        );
      })}
      {state?.error && (
        <p role="alert" className="rounded-md border border-ink px-3 py-2 text-sm font-medium">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="rounded-md bg-soft px-3 py-2 text-sm">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="h-11 w-full cursor-pointer rounded-md bg-black text-sm font-semibold text-white transition-colors duration-150 hover:bg-ink disabled:opacity-60">
        {submit}
      </button>
      {footer}
    </form>
  );
}
