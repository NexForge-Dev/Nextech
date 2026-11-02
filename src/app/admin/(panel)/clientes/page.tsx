import { Download, Mail } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { listCustomers } from "@/lib/data/admin/customers";
import { PageHeader } from "@/components/admin/page-header";
import { ButtonLink, DataTable, EmptyPanel } from "@/components/admin/data-table";

export const metadata = { title: "Clientes" };

const PAGE = 50;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const ctx = await pageGuard("customers.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listCustomers({ q: sp.q, page, pageSize: PAGE });
  const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${total} conta(s) cadastrada(s) na loja. Nenhum dado de pagamento é armazenado.`}
        actions={
          <>
            <ButtonLink href="/admin/clientes/mensagens" variant="secondary"><Mail className="size-4" /> Mensagens</ButtonLink>
            {ctx.permissions.has("customers.export") && <a href="/admin/clientes/exportar" download className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-4 text-sm font-medium hover:bg-soft"><Download className="size-4" /> Exportar CSV</a>}
          </>
        }
      />
      <DataTable
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE}
        params={{ q: sp.q }}
        basePath="/admin/clientes"
        searchPlaceholder="Buscar por nome ou e-mail"
        empty={<EmptyPanel title="Nenhum cliente" text="Clientes aparecem aqui quando criam conta na loja." />}
        columns={[
          { key: "name", header: "Nome", cell: (r) => r.name ?? <span className="text-mute">—</span> },
          { key: "email", header: "E-mail", cell: (r) => <span>{r.email}{r.isAdmin && <span className="ml-2 text-xs text-mute">(admin)</span>}</span> },
          { key: "created", header: "Cadastro", cell: (r) => <span className="tabular text-xs">{date(r.createdAt)}</span> },
          { key: "last", header: "Última atividade", cell: (r) => <span className="tabular text-xs text-mute">{date(r.lastSignIn)}</span> },
          { key: "fav", header: "Favoritos", cell: (r) => <span className="tabular">{r.favorites}</span> },
        ]}
      />
    </>
  );
}
