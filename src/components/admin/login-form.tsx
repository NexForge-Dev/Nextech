"use client";
import { useActionState } from "react";
import { adminSignIn } from "@/actions/admin/session";

export function AdminLoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(adminSignIn, null);
  const input = "h-11 w-full rounded-md border border-line px-3 text-[15px] outline-none focus:border-black";
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="a-email" className="mb-1.5 block text-sm font-medium">E-mail</label>
        <input id="a-email" name="email" type="email" autoComplete="email" required className={input} />
      </div>
      <div>
        <label htmlFor="a-password" className="mb-1.5 block text-sm font-medium">Senha</label>
        <input id="a-password" name="password" type="password" autoComplete="current-password" required className={input} />
      </div>
      {state?.error && <p role="alert" className="rounded-md border border-ink px-3 py-2 text-sm font-medium">{state.error}</p>}
      <button type="submit" disabled={pending} className="h-11 w-full cursor-pointer rounded-md bg-black text-sm font-semibold text-white hover:bg-ink disabled:opacity-60">
        Entrar
      </button>
    </form>
  );
}
