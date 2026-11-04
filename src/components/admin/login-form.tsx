"use client";
import { useActionState, useState } from "react";
import { adminSignIn } from "@/actions/admin/session";

export function AdminLoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(adminSignIn, null);
  // React resets uncontrolled fields after a form action; keep the e-mail so a wrong password only needs the password retyped.
  const [email, setEmail] = useState("");
  const input = "field";
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="a-email" className="field-label">E-mail</label>
        <input id="a-email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      </div>
      <div>
        <label htmlFor="a-password" className="field-label">Senha</label>
        <input id="a-password" name="password" type="password" autoComplete="current-password" required className={input} />
      </div>
      {state?.error && <p role="alert" className="rounded-md border border-ink px-3 py-2 text-sm font-medium">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary h-11 w-full font-semibold">
        Entrar
      </button>
    </form>
  );
}
