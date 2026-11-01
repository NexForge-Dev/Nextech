import Link from "next/link";
import { Plus } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { CategoryIcon } from "@/components/category-icon";
import { PageHeader } from "@/components/admin/page-header";
import { ButtonLink, DataTable, EmptyPanel, StatusPill } from "@/components/admin/data-table";
import { CategoryRowActions } from "@/components/admin/taxonomy-forms";

export const metadata = { title: "Categorias" };

type Row = { id: string; slug: string; icon: string; sort_order: number; active: boolean; name: string; products: number };

export default async function CategoriesPage() {
  await pageGuard("categories.write");
  const sb = await createServerSupabase();
  const { data } = await sb.from("categories").select("id, slug, icon, sort_order, active, category_translations(locale, name), products(count)").order("sort_order").order("slug");
  const rows: Row[] = (data ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    icon: c.icon,
    sort_order: c.sort_order,
    active: c.active,
    name: c.category_translations.find((t) => t.locale === "pt-BR")?.name ?? c.slug,
    products: (c.products as unknown as { count: number }[])[0]?.count ?? 0,
  }));
  return (
    <>
      <PageHeader title="Categorias" description="Organize o catálogo. A ordem define a exibição na loja." actions={<ButtonLink href="/admin/categorias/novo"><Plus className="size-4" /> Nova categoria</ButtonLink>} />
      <DataTable
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={1000}
        params={{}}
        basePath="/admin/categorias"
        empty={<EmptyPanel title="Nenhuma categoria" text="Crie a primeira categoria para organizar os produtos." action={<ButtonLink href="/admin/categorias/novo">Nova categoria</ButtonLink>} />}
        columns={[
          { key: "icon", header: "", className: "w-10", cell: (r) => <CategoryIcon name={r.icon} className="size-4" /> },
          { key: "name", header: "Nome", cell: (r) => <Link href={`/admin/categorias/${r.id}`} className="font-medium hover:underline">{r.name}</Link> },
          { key: "slug", header: "Slug", cell: (r) => <span className="font-mono text-xs text-mute">{r.slug}</span> },
          { key: "products", header: "Produtos", cell: (r) => <span className="tabular">{r.products}</span> },
          { key: "order", header: "Ordem", cell: (r) => <span className="tabular text-mute">{r.sort_order}</span> },
          { key: "status", header: "Status", cell: (r) => <StatusPill active={r.active} /> },
          { key: "actions", header: "", className: "text-right", cell: (r) => <CategoryRowActions id={r.id} name={r.name} /> },
        ]}
      />
    </>
  );
}
