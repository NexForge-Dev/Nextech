import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { formatCurrencyAmounts, groupByCurrency } from "@/lib/domain/aggregates";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, EmptyPanel } from "@/components/admin/data-table";

export const metadata = { title: "Conversões e comissões" };

const PAGE = 50;
const STATUS: Record<string, string> = { pending: "Pendente", confirmed: "Confirmada", rejected: "Rejeitada" };

export default async function ConversionsPage({ searchParams }: { searchParams: Promise<{ network?: string; status?: string; page?: string }> }) {
  await pageGuard("analytics.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sb = await createServerSupabase();
  const { data: networks } = await sb.from("affiliate_networks").select("id, name").order("name");
  let q = sb
    .from("affiliate_conversions")
    .select("id, external_id, occurred_at, status, sale_amount_minor, currency, source, click_id, product_id, affiliate_networks(name), products(product_translations(locale, name)), affiliate_commissions(amount_minor, currency, status)", { count: "exact" })
    .order("occurred_at", { ascending: false });
  let cq = sb.from("affiliate_commissions").select("amount_minor, currency, status");
  if (sp.network && /^[0-9a-f-]{36}$/i.test(sp.network)) {
    q = q.eq("network_id", sp.network);
    cq = cq.eq("network_id", sp.network);
  }
  if (sp.status && STATUS[sp.status]) q = q.eq("status", sp.status);
  const [{ data, count }, { data: all }] = await Promise.all([q.range((page - 1) * PAGE, page * PAGE - 1), cq.limit(50000)]);
  const g = groupByCurrency((all ?? []).map((c) => ({ amountMinor: c.amount_minor, currency: c.currency, status: c.status })));
  const sel = "h-10 rounded-md border border-line bg-white px-3 text-sm";
  return (
    <>
      <PageHeader title="Conversões e comissões" description="Somente valores reportados pelas redes (API ou relatório importado). Cliques não são vendas." />
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          ["Estimadas (pendentes)", g.pending],
          ["Confirmadas", g.confirmed],
          ["Rejeitadas", g.rejected],
        ].map(([label, list]) => (
          <div key={label as string} className="rounded-md border border-line p-4">
            <p className="text-xs text-mute">{label as string}</p>
            <p className="tabular mt-1 text-lg font-semibold">{formatCurrencyAmounts(list as never, "pt-BR")}</p>
          </div>
        ))}
      </div>
      <DataTable
        rows={(data ?? []).map((c) => ({ ...c, productName: c.products?.product_translations.find((t) => t.locale === "pt-BR")?.name ?? null }))}
        total={count ?? 0}
        page={page}
        pageSize={PAGE}
        params={sp}
        basePath="/admin/afiliados/conversoes"
        filters={
          <>
            <select name="network" defaultValue={sp.network ?? ""} aria-label="Rede" className={sel}>
              <option value="">Todas as redes</option>
              {(networks ?? []).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
            <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className={sel}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </>
        }
        empty={<EmptyPanel title="Nenhuma conversão reportada" text="Conversões aparecem aqui quando uma rede é sincronizada ou um relatório é importado." />}
        columns={[
          { key: "date", header: "Data", cell: (r) => <span className="tabular text-xs">{new Date(r.occurred_at).toLocaleDateString("pt-BR")}</span> },
          { key: "network", header: "Rede", cell: (r) => r.affiliate_networks?.name ?? "—" },
          { key: "id", header: "ID externo", cell: (r) => <span className="font-mono text-xs">{r.external_id.slice(0, 24)}</span> },
          { key: "product", header: "Produto (via clique)", cell: (r) => (r.product_id ? <Link href={`/admin/produtos/${r.product_id}`} className="hover:underline">{r.productName ?? "—"}</Link> : <span className="text-xs text-mute">Não atribuído</span>) },
          { key: "sale", header: "Venda", cell: (r) => (r.sale_amount_minor != null && r.currency ? <span className="tabular">{formatMoney(r.sale_amount_minor, r.currency, "pt-BR")}</span> : "—") },
          { key: "commission", header: "Comissão", cell: (r) => { const c = r.affiliate_commissions[0]; return c ? <span className="tabular">{formatMoney(c.amount_minor, c.currency, "pt-BR")}</span> : "—"; } },
          { key: "status", header: "Status", cell: (r) => <span className={r.status === "confirmed" ? "font-semibold" : "text-mute"}>{STATUS[r.status]}</span> },
          { key: "source", header: "Fonte", cell: (r) => <span className="text-xs text-mute">{r.source === "integration" ? "API" : r.source === "import" ? "Relatório" : "Manual"}</span> },
        ]}
      />
    </>
  );
}
