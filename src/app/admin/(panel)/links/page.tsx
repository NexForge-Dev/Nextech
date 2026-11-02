import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, EmptyPanel, StatusPill } from "@/components/admin/data-table";

export const metadata = { title: "Links de afiliados" };

function olderThan(iso: string | null, days: number): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() > days * 86_400_000;
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const PAGE = 50;
type Search = { store?: string; network?: string; market?: string; active?: string; stale?: string; page?: string };

export default async function LinksPage({ searchParams }: { searchParams: Promise<Search> }) {
  await pageGuard("links.write");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sb = await createServerSupabase();
  const [{ data: stores }, { data: networks }, { data: staleSetting }] = await Promise.all([
    sb.from("stores").select("id, name").order("name"),
    sb.from("affiliate_networks").select("id, name").order("name"),
    sb.from("site_settings").select("value").eq("key", "ops.price_stale_days").maybeSingle(),
  ]);
  const staleDays = Number(staleSetting?.value ?? 14) || 14;
  let q = sb
    .from("affiliate_links")
    .select("id, product_id, market, currency, price_minor, price_updated_at, price_source, active, affiliate_url, original_url, stores(name), affiliate_networks(name), products(product_translations(locale, name))", { count: "exact" })
    .order("updated_at", { ascending: false });
  if (sp.store) q = q.eq("store_id", sp.store);
  if (sp.network) q = q.eq("network_id", sp.network);
  if (sp.market && /^[A-Z]{2}$/.test(sp.market)) q = q.eq("market", sp.market);
  if (sp.active === "1") q = q.eq("active", true);
  if (sp.active === "0") q = q.eq("active", false);
  if (sp.stale === "1") q = q.not("price_minor", "is", null).lt("price_updated_at", daysAgoIso(staleDays));
  const { data, count } = await q.range((page - 1) * PAGE, page * PAGE - 1);
  const rows = (data ?? []).map((l) => ({
    ...l,
    name: l.products?.product_translations.find((t) => t.locale === "pt-BR")?.name ?? "—",
    stale: olderThan(l.price_updated_at, staleDays),
  }));
  const sel = "h-10 rounded-md border border-line bg-white px-3 text-sm";
  return (
    <>
      <PageHeader title="Links de afiliados" description="Todas as ofertas cadastradas nos produtos. Edite uma oferta pelo produto." />
      <DataTable
        rows={rows}
        total={count ?? 0}
        page={page}
        pageSize={PAGE}
        params={sp}
        basePath="/admin/links"
        filters={
          <>
            <select name="store" defaultValue={sp.store ?? ""} aria-label="Loja" className={sel}>
              <option value="">Todas as lojas</option>
              {(stores ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select name="network" defaultValue={sp.network ?? ""} aria-label="Rede" className={sel}>
              <option value="">Todas as redes</option>
              {(networks ?? []).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
            <input name="market" defaultValue={sp.market ?? ""} placeholder="País (BR)" aria-label="País" maxLength={2} className={`${sel} w-24 uppercase`} />
            <select name="active" defaultValue={sp.active ?? ""} aria-label="Status" className={sel}>
              <option value="">Ativos e inativos</option>
              <option value="1">Ativos</option>
              <option value="0">Inativos</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="stale" value="1" defaultChecked={sp.stale === "1"} className="size-4 accent-black" /> Preço desatualizado (&gt; {staleDays} dias)</label>
          </>
        }
        empty={<EmptyPanel title="Nenhum link encontrado" text="Links de afiliados são criados nas ofertas de cada produto." />}
        columns={[
          { key: "product", header: "Produto", cell: (r) => <Link href={`/admin/produtos/${r.product_id}`} className="font-medium hover:underline">{r.name}</Link> },
          { key: "store", header: "Loja", cell: (r) => r.stores?.name ?? "—" },
          { key: "network", header: "Rede", cell: (r) => r.affiliate_networks?.name ?? <span className="text-mute">Manual</span> },
          { key: "market", header: "País", cell: (r) => <span className="font-mono text-xs">{r.market}</span> },
          { key: "price", header: "Preço", cell: (r) => (r.price_minor != null ? <span className="tabular">{formatMoney(r.price_minor, r.currency, "pt-BR")}</span> : <span className="text-mute">Sem preço</span>) },
          { key: "updated", header: "Atualizado", cell: (r) => (r.price_updated_at ? <span className={`tabular text-xs ${r.stale ? "font-semibold" : "text-mute"}`}>{new Date(r.price_updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}{r.stale ? " ⚠" : ""}</span> : "—") },
          { key: "source", header: "Fonte", cell: (r) => <span className="text-xs text-mute">{r.price_source === "manual" ? "Manual" : r.price_source === "import" ? "Importação" : r.price_source === "integration" ? "Integração" : "—"}</span> },
          { key: "aff", header: "Link afiliado", cell: (r) => <span className="text-xs">{r.affiliate_url ? "Sim" : <span className="text-mute">Original</span>}</span> },
          { key: "status", header: "Status", cell: (r) => <StatusPill active={r.active} /> },
        ]}
      />
    </>
  );
}
