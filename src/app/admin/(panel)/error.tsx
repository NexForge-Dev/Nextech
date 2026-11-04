"use client";
import Link from "next/link";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Não foi possível carregar esta página</h1>
      <p className="mt-2 text-sm text-mute">Ocorreu um erro inesperado. Tente novamente; se persistir, verifique o log do servidor{error.digest ? ` (código ${error.digest})` : ""}.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" onClick={reset} className="btn btn-primary">Tentar novamente</button>
        <Link href="/admin" className="btn btn-secondary">Visão geral</Link>
      </div>
    </div>
  );
}
