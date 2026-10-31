import Link from "next/link";
import { Download, Plus, Star, Upload } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { storagePublicUrl } from "@/lib/supabase/env";
import { formatMoney } from "@/lib/domain/money";
import { clicks30d } from "@/lib/data/admin/products";
import { PageHeader } from "@/components/admin/page-header";
import { ButtonLink, DataTable, EmptyPanel, StatusPill } from "@/components/admin/data-table";
import { ProductRowActions } from "@/components/admin/product-row-actions";

export const metadata = { title: "Produtos" };

const PAGE = 25;
const STATUS_LABEL: Record<string, string> = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" };

type Search = { q?: string; status?: string; category?: string; page?: string; sort?: string };

export default async function ProductsAdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await pageGuard("products.write");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sb = await createServerSupabase();
  const { data: cats } = await sb.from("categories").select("id, slug, category_translations(locale, name)").order("sort_order");

  let query = sb
    .from("products")
    .select("id, slug, status, featured, updated_at, sku, categories(category_translations(locale, name)), product_translations!inner(locale, name), product_images(path, is_main), affiliate_links(price_minor, currency, active, stores(name))", { count: "exact" })
    .eq("product_translations.locale", "pt-BR");
  if (sp.q) {
    const term = sp.q.replace(/[%_\\]/g, (c) => `\\${c}`).trim();
    query = query.ilike("product_translations.name", `%${term}%`);
  }
  if (sp.status && ["draft", "published", "archived"].includes(sp.status)) query = query.eq("status", sp.status);
  if (sp.category) query = query.eq("category_id", sp.category);
  const sortKey = sp.sort?.replace(/^-/, "");
  query = sortKey === "updated" ? query.order("updated_at", { ascending: !sp.sort?.startsWith("-") }) : query.order("updated_at", { ascending: false });
  const { data, count } = await query.range((page - 1) * PAGE, page * PAGE - 1);
  const rows = (data ?? []).map((p) => {
    const main = p.product_images.find((i) => i.is_main) ?? p.product_images[0];
    const active = p.affiliate_links.filter((l) => l.active);
    const priced = active.filter((l) => l.price_minor != null).sort((a, b) => a.price_minor! - b.price_minor!)[0];
    return {
      id: p.id,
      slug: p.slug,
      status: p.status,
      featured: p.featured,
      updated: p.updated_at,
      sku: p.sku,
      name: p.product_translations[0]?.name ?? p.slug,
      category: p.categories?.category_translations.find((t) => t.locale === "pt-BR")?.name ?? "—",
      image: storagePublicUrl("products", main?.path),
      price: priced ? formatMoney(priced.price_minor!, priced.currency, "pt-BR") : null,
      stores: [...new Set(active.map((l) => l.stores?.name).filter(Boolean))].join(", "),
    };
  });
  const clicks = await clicks30d(rows.map((r) => r.id));
  const canImport = ctx.permissions.has("products.import");

  return (
    <>
      <PageHeader
        title="Produtos"
        description={`${count ?? 0} produto(s) cadastrados.`}
        actions={
          <>
            {canImport && <ButtonLink href="/admin/produtos/importar" variant="secondary"><Upload className="size-4" /> Importar CSV</ButtonLink>}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler */}
            {canImport && <a href="/admin/produtos/exportar" download className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-4 text-sm font-medium hover:bg-soft"><Download className="size-4" /> Exportar CSV</a>}
            <ButtonLink href="/admin/produtos/novo"><Plus className="size-4" /> Novo produto</ButtonLink>
          </>
        }
      />
      <DataTable
        rows={rows}
        total={count ?? 0}
        page={page}
        pageSize={PAGE}
        params={{ q: sp.q, status: sp.status, category: sp.category, sort: sp.sort }}
        basePath="/admin/produtos"
        searchPlaceholder="Buscar por nome"
        filters={
          <>
            <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="h-10 rounded-md border border-line bg-white px-3 text-sm">
              <option value="">Todos os status</option>
              <option value="published">Publicados</option>
              <option value="draft">Rascunhos</option>
              <option value="archived">Arquivados</option>
            </select>
            <select name="category" defaultValue={sp.category ?? ""} aria-label="Categoria" className="h-10 rounded-md border border-line bg-white px-3 text-sm">
              <option value="">Todas as categorias</option>
              {(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.category_translations.find((t) => t.locale === "pt-BR")?.name ?? c.slug}</option>)}
            </select>
          </>
        }
        empty={<EmptyPanel title={sp.q || sp.status || sp.category ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"} text="Cadastre uma loja parceira e depois o primeiro produto com sua oferta." action={<ButtonLink href="/admin/produtos/novo">Novo produto</ButtonLink>} />}
        columns={[
          {
            key: "img",
            header: "",
            className: "w-14",
            cell: (r) => (
              <div className="size-10 overflow-hidden rounded bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.image && <img src={r.image} alt="" className="h-full w-full object-contain" />}
              </div>
            ),
          },
          {
            key: "name",
            header: "Nome",
            cell: (r) => (
              <div className="min-w-0">
                <Link href={`/admin/produtos/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                {r.featured && <Star className="ml-1.5 inline size-3.5 fill-black" aria-label="Destaque" />}
                {r.sku && <p className="font-mono text-xs text-mute">{r.sku}</p>}
              </div>
            ),
          },
          { key: "cat", header: "Categoria", cell: (r) => r.category },
          { key: "price", header: "Preço", cell: (r) => (r.price ? <span className="tabular">{r.price}</span> : <span className="text-mute">—</span>) },
          { key: "store", header: "Loja", cell: (r) => <span className="text-xs">{r.stores || <span className="text-mute">Sem oferta</span>}</span> },
          { key: "clicks", header: "Cliques (30d)", cell: (r) => <span className="tabular">{clicks.get(r.id) ?? 0}</span> },
          { key: "status", header: "Status", cell: (r) => <StatusPill active={r.status === "published"} on={STATUS_LABEL[r.status]} off={STATUS_LABEL[r.status]} /> },
          { key: "updated", header: "Atualização", sortKey: "updated", cell: (r) => <span className="tabular text-xs text-mute">{new Date(r.updated).toLocaleDateString("pt-BR")}</span> },
          { key: "actions", header: "", className: "text-right", cell: (r) => <ProductRowActions id={r.id} slug={r.slug} name={r.name} status={r.status} featured={r.featured} canDelete={ctx.permissions.has("products.delete")} /> },
        ]}
      />
    </>
  );
}
