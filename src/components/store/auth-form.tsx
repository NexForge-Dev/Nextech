"use client";
import { useActionState, useState, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import type { AuthState } from "@/actions/store/auth";
import { Notice } from "./ui";

type Field = { name: string; label: string; type?: string; autoComplete?: string; defaultValue?: string; required?: boolean };

export const inputClass = "field";

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
            <label htmlFor={`f-${f.name}`} className="field-label">
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
              <p id={`e-${f.name}`} className="field-error">
                <CircleAlert aria-hidden />
                {err}
              </p>
            )}
          </div>
        );
      })}
      {state?.error && (
        <Notice tone="error">{state.error}</Notice>
      )}
      {state?.message && (
        <Notice tone="success">{state.message}</Notice>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary h-11 w-full font-semibold">
        {submit}
      </button>
      {footer}
    </form>
  );
}
