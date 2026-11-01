import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { getAdminContext } from "@/lib/auth/session";

export const metadata = { title: "Acesso restrito" };

export default async function RestrictedPage() {
  const ctx = await getAdminContext();
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <ShieldOff className="mx-auto size-8" strokeWidth={1.5} aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Acesso restrito</h1>
        <p className="mt-2 text-sm text-mute">
          {ctx ? "Seu perfil de administrador não tem permissão para esta área." : "Esta conta não tem acesso ao painel administrativo."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {ctx && <Link href="/admin" className="inline-flex h-10 items-center rounded-md bg-black px-5 text-sm font-medium text-white hover:bg-ink">Voltar ao painel</Link>}
          <Link href="/" className="inline-flex h-10 items-center rounded-md border border-line px-5 text-sm font-medium hover:bg-soft">Ir para a loja</Link>
        </div>
      </div>
    </main>
  );
}
