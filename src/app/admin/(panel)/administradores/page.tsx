import { Check } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { createServiceSupabase } from "@/lib/supabase/service";
import { ROLE_LABELS, type RoleKey } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, EmptyPanel, StatusPill } from "@/components/admin/data-table";
import { FormSection } from "@/components/admin/form";
import { AdminRowActions, InviteAdminForm } from "@/components/admin/people-forms";

export const metadata = { title: "Administradores" };

const MATRIX: [string, string, string, string][] = [
  ["Produtos, marcas, categorias, ofertas de produtos", "✓", "✓", "✓ (sem excluir)"],
  ["Importar/exportar produtos (CSV)", "✓", "✓", "—"],
  ["Lojas parceiras", "✓", "✓", "—"],
  ["Redes de afiliados, credenciais e sincronização", "✓", "Somente leitura", "—"],
  ["Ofertas, banners e campanhas", "✓", "✓", "✓"],
  ["Analytics e relatórios", "✓", "✓", "—"],
  ["Importar conversões e comissões", "✓", "✓", "—"],
  ["Clientes e mensagens", "✓", "Leitura (sem exportar)", "—"],
  ["Configurações e informações legais", "✓", "—", "—"],
  ["Administradores e perfis", "✓", "—", "—"],
  ["Log de auditoria", "✓", "✓", "—"],
];

export default async function AdminsPage() {
  const ctx = await pageGuard("admins.write");
  const svc = createServiceSupabase();
  const [{ data: admins }, users] = await Promise.all([svc.from("admin_users").select("user_id, active, created_at, admin_roles(key)").order("created_at"), svc.auth.admin.listUsers({ perPage: 1000 })]);
  const emailOf = new Map((users.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const rows = (admins ?? []).map((a) => ({ id: a.user_id, email: emailOf.get(a.user_id) ?? a.user_id, role: (a.admin_roles?.key ?? "editor") as RoleKey, active: a.active, since: a.created_at }));
  return (
    <>
      <PageHeader title="Administradores" description="Permissões são verificadas no servidor e no banco (RLS), não apenas escondidas na interface." />
      <FormSection title="Convidar administrador" description="Se a pessoa ainda não tiver conta, receberá um e-mail para definir a senha.">
        <InviteAdminForm />
      </FormSection>
      <DataTable
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={1000}
        params={{}}
        basePath="/admin/administradores"
        empty={<EmptyPanel title="Nenhum administrador" />}
        columns={[
          { key: "email", header: "E-mail", cell: (r) => r.email },
          { key: "role", header: "Perfil", cell: (r) => ROLE_LABELS[r.role] },
          { key: "since", header: "Desde", cell: (r) => <span className="tabular text-xs">{new Date(r.since).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span> },
          { key: "status", header: "Status", cell: (r) => <StatusPill active={r.active} /> },
          { key: "actions", header: "", className: "text-right", cell: (r) => <AdminRowActions userId={r.id} role={r.role} active={r.active} isSelf={r.id === ctx.userId} /> },
        ]}
      />
      <section className="mt-10">
        <h2 className="mb-3 font-semibold">Permissões por perfil</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line bg-soft text-left text-[11px] uppercase tracking-[0.06em] text-mute">
                <th className="px-4 py-2 font-medium">Área</th>
                <th className="px-4 py-2 font-medium">Superadministrador</th>
                <th className="px-4 py-2 font-medium">Administrador</th>
                <th className="px-4 py-2 font-medium">Editor</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((r) => (
                <tr key={r[0]} className="border-b border-line last:border-0">
                  {r.map((c, i) => <td key={i} className={`px-4 py-2 ${i === 0 ? "" : "text-center"}`}>{c.startsWith("✓") ? <span className="inline-flex items-center gap-1"><Check className="size-4" aria-label="Permitido" />{c.slice(1).trim()}</span> : c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
