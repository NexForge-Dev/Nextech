import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/domain/safe-next";
import { AdminLoginForm } from "@/components/admin/login-form";

export const metadata = { title: "Entrar" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSessionUser()) redirect("/admin");
  const next = safeNextPath((await searchParams).next) ?? "";
  return (
    <main className="flex min-h-screen items-center justify-center bg-soft px-4">
      <div className="w-full max-w-sm rounded-md border border-line bg-white p-8">
        <p className="wordmark text-xl">NEXTECH</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-widest text-mute">Admin</p>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Entrar no painel</h1>
        <AdminLoginForm next={next} />
      </div>
    </main>
  );
}
