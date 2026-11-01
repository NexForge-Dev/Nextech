"use client";
import Link from "next/link";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Não foi possível carregar esta página</h1>
      <p className="mt-2 text-sm text-mute">Ocorreu um erro inesperado. Tente novamente; se persistir, verifique o log do servidor{error.digest ? ` (código ${error.digest})` : ""}.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" onClick={reset} className="h-10 cursor-pointer rounded-md bg-black px-5 text-sm font-medium text-white hover:bg-ink">Tentar novamente</button>
        <Link href="/admin" className="inline-flex h-10 items-center rounded-md border border-line px-5 text-sm font-medium hover:bg-soft">Visão geral</Link>
      </div>
    </div>
  );
}
