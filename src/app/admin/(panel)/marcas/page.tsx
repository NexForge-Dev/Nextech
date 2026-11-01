import Link from "next/link";
import { Plus } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { ButtonLink, DataTable, EmptyPanel, StatusPill } from "@/components/admin/data-table";

export const metadata = { title: "Marcas" };

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await pageGuard("brands.write");
  const { q } = await searchParams;
  const sb = await createServerSupabase();
  let query = sb.from("brands").select("id, name, slug, active, products(count)").order("name");
  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  const { data } = await query;
  const rows = (data ?? []).map((b) => ({ ...b, count: (b.products as unknown as { count: number }[])[0]?.count ?? 0 }));
  return (
    <>
      <PageHeader title="Marcas" actions={<ButtonLink href="/admin/marcas/novo"><Plus className="size-4" /> Nova marca</ButtonLink>} />
      <DataTable
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={10000}
        params={{ q }}
        basePath="/admin/marcas"
        searchPlaceholder="Buscar marca"
        empty={<EmptyPanel title={q ? "Nenhuma marca encontrada" : "Nenhuma marca"} text="Marcas ajudam o cliente a filtrar e encontrar produtos." action={<ButtonLink href="/admin/marcas/novo">Nova marca</ButtonLink>} />}
        columns={[
          { key: "name", header: "Nome", cell: (r) => <Link href={`/admin/marcas/${r.id}`} className="font-medium hover:underline">{r.name}</Link> },
          { key: "slug", header: "Slug", cell: (r) => <span className="font-mono text-xs text-mute">{r.slug}</span> },
          { key: "count", header: "Produtos", cell: (r) => <span className="tabular">{r.count}</span> },
          { key: "status", header: "Status", cell: (r) => <StatusPill active={r.active} /> },
        ]}
      />
    </>
  );
}
