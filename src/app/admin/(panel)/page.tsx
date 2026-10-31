import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { parsePeriod } from "@/lib/domain/period";
import { formatCurrencyAmounts } from "@/lib/domain/aggregates";
import { getCatalogCounts, getMetrics } from "@/lib/data/admin/metrics";
import { PageHeader } from "@/components/admin/page-header";
import { PeriodFilter } from "@/components/admin/period-filter";
import { CommissionsChart, DailyLine, KpiCard, RankBar } from "@/components/admin/charts";

export const metadata = { title: "Visão geral" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageGuard();
  const sp = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => typeof e[1] === "string"));
  const counts = await getCatalogCounts();
  const canAnalytics = ctx.permissions.has("analytics.read");

  if (!canAnalytics) {
    return (
      <>
        <PageHeader title="Visão geral" description="Indicadores do catálogo." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total de produtos" value={String(counts.total)} />
          <KpiCard label="Produtos ativos" value={String(counts.active)} />
          <KpiCard label="Produtos inativos" value={String(counts.inactive)} hint="Rascunhos e arquivados" />
          <KpiCard label="Categorias" value={String(counts.categories)} />
        </div>
        <p className="mt-6 text-sm text-mute">Relatórios de cliques e comissões estão disponíveis para perfis com acesso a analytics.</p>
      </>
    );
  }

  const period = parsePeriod(sp);
  const last30 = parsePeriod(new URLSearchParams("p=30d"));
  const [m, m30] = await Promise.all([getMetrics(period), period.key === "30d" ? null : getMetrics(last30)]);
  const clicks30 = (m30 ?? m).totalClicks;
  const days = m.clicksByDay.map((d) => d.key);

  return (
    <>
      <PageHeader title="Visão geral" description="Dados reais do banco e das redes de afiliados. Cliques não são vendas: conversões e comissões vêm somente das redes." />
      <PeriodFilter current={period.key} from={period.fromDate} to={period.toDate} />
      <h2 className="sr-only">Indicadores</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total de produtos" value={String(counts.total)} />
        <KpiCard label="Produtos ativos" value={String(counts.active)} />
        <KpiCard label="Produtos inativos" value={String(counts.inactive)} />
        <KpiCard label="Categorias" value={String(counts.categories)} />
        <KpiCard label="Cliques nos links (total)" value={String(counts.allClicks)} hint="Desde o início, sem robôs" />
        <KpiCard label="Cliques — últimos 30 dias" value={String(clicks30)} />
        <KpiCard label="Conversões reportadas" value={String(m.conversions)} hint="No período, pelas redes" />
        <KpiCard label="Comissões estimadas" value={formatCurrencyAmounts(m.commissions.pending, "pt-BR")} hint="Pendentes, como reportado" />
        <KpiCard label="Comissões pendentes" value={formatCurrencyAmounts(m.commissions.pending, "pt-BR")} hint="Aguardando confirmação da rede" />
        <KpiCard label="Comissões confirmadas" value={formatCurrencyAmounts(m.commissions.confirmed, "pt-BR")} />
      </div>
      <div className="mt-8 grid gap-4 xl:grid-cols-2">
        <DailyLine title="Cliques por dia" data={m.clicksByDay} valueLabel="Cliques" />
        <CommissionsChart points={m.commissionsDaily} days={days} />
        <RankBar title="Produtos mais acessados" data={m.viewsByProduct} valueLabel="Visualizações" />
        <RankBar title="Categorias mais populares (cliques)" data={m.clicksByCategory} valueLabel="Cliques" />
        <RankBar title="Cliques por plataforma de afiliados" data={m.clicksByNetwork} valueLabel="Cliques" />
        <RankBar title="Desempenho das campanhas (cliques)" data={m.clicksByCampaign} valueLabel="Cliques" />
      </div>
      <section className="mt-8 rounded-md border border-line">
        <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">Produtos com maior desempenho</h2>
        {m.topProducts.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-mute">Sem dados ainda</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line bg-soft text-left text-xs uppercase tracking-wider text-mute">
                  <th className="px-5 py-2 font-medium">Produto</th>
                  <th className="px-5 py-2 text-right font-medium">Visualizações</th>
                  <th className="px-5 py-2 text-right font-medium">Cliques</th>
                  <th className="px-5 py-2 text-right font-medium">Taxa de cliques</th>
                </tr>
              </thead>
              <tbody>
                {m.topProducts.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-2"><Link href={`/admin/produtos/${p.id}/desempenho`} className="hover:underline">{p.name}</Link></td>
                    <td className="tabular px-5 py-2 text-right">{p.views}</td>
                    <td className="tabular px-5 py-2 text-right">{p.clicks}</td>
                    <td className="tabular px-5 py-2 text-right">{p.ctr != null ? `${(p.ctr * 100).toFixed(1).replace(".", ",")}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
