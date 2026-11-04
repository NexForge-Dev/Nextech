import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { parsePeriod } from "@/lib/domain/period";
import { formatCurrencyAmounts } from "@/lib/domain/aggregates";
import { getMetrics } from "@/lib/data/admin/metrics";
import { productOptions, campaignOptions } from "@/lib/data/admin/marketing";
import { PageHeader } from "@/components/admin/page-header";
import { PeriodFilter } from "@/components/admin/period-filter";
import { CommissionsChart, DailyLine, KpiCard, RankBar } from "@/components/admin/charts";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageGuard("analytics.read");
  const raw = await searchParams;
  const sp = new URLSearchParams(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string"));
  const period = parsePeriod(sp);
  const filters = { product: raw.product, category: raw.category, campaign: raw.campaign, network: raw.network };
  const sb = await createServerSupabase();
  const [m, products, campaigns, { data: cats }, { data: nets }] = await Promise.all([
    getMetrics(period, filters),
    productOptions(),
    campaignOptions(),
    sb.from("categories").select("id, slug, category_translations(locale, name)").order("sort_order"),
    sb.from("affiliate_networks").select("id, name").order("name"),
  ]);
  const sel = "field h-9 w-auto max-w-56 px-2";
  return (
    <>
      <PageHeader title="Analytics" description="Visualizações e cliques registrados pela NEXTECH; conversões e comissões reportadas pelas redes." />
      <PeriodFilter current={period.key} from={period.fromDate} to={period.toDate} />
      <form method="get" className="mb-6 flex flex-wrap items-center gap-2">
        {Object.entries(raw).filter(([k, v]) => ["p", "from", "to"].includes(k) && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <select name="product" defaultValue={raw.product ?? ""} aria-label="Produto" className={sel}>
          <option value="">Todos os produtos</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="category" defaultValue={raw.category ?? ""} aria-label="Categoria" className={sel}>
          <option value="">Todas as categorias</option>
          {(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.category_translations.find((t) => t.locale === "pt-BR")?.name ?? c.slug}</option>)}
        </select>
        <select name="campaign" defaultValue={raw.campaign ?? ""} aria-label="Campanha" className={sel}>
          <option value="">Todas as campanhas</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="network" defaultValue={raw.network ?? ""} aria-label="Rede" className={sel}>
          <option value="">Todas as redes</option>
          {(nets ?? []).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <button type="submit" className="btn btn-secondary h-9">Filtrar</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Visualizações" value={String(m.totalViews)} hint="Páginas de produto" />
        <KpiCard label="Cliques nos links" value={String(m.totalClicks)} />
        <KpiCard label="Taxa de cliques" value={m.ctr != null ? `${(m.ctr * 100).toFixed(1).replace(".", ",")}%` : "—"} hint="Cliques ÷ visualizações" />
        <KpiCard label="Conversões reportadas" value={String(m.conversions)} />
        <KpiCard label="Comissões estimadas" value={formatCurrencyAmounts(m.commissions.pending, "pt-BR")} />
        <KpiCard label="Comissões confirmadas" value={formatCurrencyAmounts(m.commissions.confirmed, "pt-BR")} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <DailyLine title="Visualizações por dia" data={m.viewsByDay} valueLabel="Visualizações" />
        <DailyLine title="Cliques por dia" data={m.clicksByDay} valueLabel="Cliques" />
        <RankBar title="Visualizações por produto" data={m.viewsByProduct} valueLabel="Visualizações" />
        <RankBar title="Cliques por categoria" data={m.clicksByCategory} valueLabel="Cliques" />
        <RankBar title="Cliques por loja" data={m.clicksByStore} valueLabel="Cliques" />
        <RankBar title="Cliques por rede" data={m.clicksByNetwork} valueLabel="Cliques" />
        <CommissionsChart points={m.commissionsDaily} days={m.clicksByDay.map((d) => d.key)} />
        <RankBar title="Cliques por campanha" data={m.clicksByCampaign} valueLabel="Cliques" />
      </div>
    </>
  );
}
