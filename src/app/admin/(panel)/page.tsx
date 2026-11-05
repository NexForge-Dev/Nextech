import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { parsePeriod } from "@/lib/domain/period";
import { formatCurrencyAmounts } from "@/lib/domain/aggregates";
import { getCatalogCounts, getMetrics } from "@/lib/data/admin/metrics";
import { PageHeader } from "@/components/admin/page-header";
import { PeriodFilter } from "@/components/admin/period-filter";
import { CommissionsChart, DailyLine, KpiCard, RankBar } from "@/components/admin/charts";
import { orderKpis } from "@/lib/data/admin/orders";
import { formatMoney } from "@/lib/domain/money";
import { getBusinessModels, getPublicSettings } from "@/lib/data/settings";
import { ownStoreReadiness } from "@/lib/admin/launch-readiness";
import { getOrderAlerts } from "@/lib/data/admin/order-alerts";

/** Launch blockers for the own store (seller identity required by law, payment and email config). */
async function LaunchReadiness() {
  const [s, bm] = await Promise.all([getPublicSettings(), getBusinessModels()]);
  const issues = ownStoreReadiness({ ownStore: bm.ownStore, legal: s.legal, contactEmail: s.contactEmail, env: process.env });
  if (!issues.length) return null;
  return (
    <section role="alert" className="mb-6 rounded-lg border border-black bg-white p-5" data-testid="launch-readiness">
      <h2 className="text-sm font-semibold">Pendências para vender na loja própria</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
        {issues.map((i) => (
          <li key={i.key}>
            {i.message}
            {i.href && (
              <>
                {" "}
                <Link href={i.href} className="font-medium underline underline-offset-2">Preencher agora</Link>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const MAX_ALERTS_SHOWN = 50;

/** Money and orders that need action now. Comes from the database, so it works without any e-mail provider. */
async function OrderAlerts() {
  const { alerts, emailsNotSent } = await getOrderAlerts();
  if (!alerts.length && !emailsNotSent) return null;
  return (
    <section role="alert" className="mb-6 rounded-lg border border-black bg-white p-5" data-testid="order-alerts">
      <h2 className="text-sm font-semibold">Pedidos que precisam de atenção</h2>
      {alerts.length > 0 && (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {alerts.slice(0, MAX_ALERTS_SHOWN).map((a) => (
            <li key={a.key}>
              <Link href={`/admin/pedidos/${a.number}`} className="font-medium underline underline-offset-2">Pedido #{a.number}</Link>: {a.message}
              {a.emailed === false && <span className="text-mute"> (e-mail não enviado)</span>}
            </li>
          ))}
        </ul>
      )}
      {alerts.length > MAX_ALERTS_SHOWN && <p className="mt-3 text-sm font-medium">E mais {alerts.length - MAX_ALERTS_SHOWN} alerta(s). Os mais antigos aparecem primeiro; resolva-os para ver os seguintes.</p>}
      {emailsNotSent > 0 && <p className="mt-3 text-sm text-mute">{emailsNotSent} e-mail(s) de pedido não saíram nos últimos 30 dias. Confira a configuração do Resend.</p>}
    </section>
  );
}

async function OwnStoreKpis() {
  const k = await orderKpis(30);
  const money = (m: number) => formatMoney(m, "BRL", "pt-BR");
  return (
    <section className="mb-6">
      <h2 className="t-eyebrow mb-3">Loja própria — últimos 30 dias</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Pedidos pagos" value={String(k.paidOrders)} />
        <KpiCard label="Faturamento" value={money(k.revenueMinor)} hint="Pago menos reembolsos" />
        <KpiCard label="Margem bruta" value={money(k.marginMinor)} hint={`${k.marginKnown} pedido(s) com custo registrado`} />
        <Link href="/admin/pedidos?status=awaiting_supplier" className="block"><KpiCard label="Aguardando compra" value={String(k.awaitingSupplier)} hint="Compre no fornecedor" /></Link>
      </div>
    </section>
  );
}

export const metadata = { title: "Visão geral" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageGuard();
  const sp = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => typeof e[1] === "string"));
  const counts = await getCatalogCounts();
  const canAnalytics = ctx.permissions.has("analytics.read");
  const canOrders = ctx.permissions.has("orders.read");
  const ownStore = canOrders || ctx.permissions.has("settings.write") ? (
    <>
      <LaunchReadiness />
      {canOrders && <OrderAlerts />}
      {canOrders && <OwnStoreKpis />}
    </>
  ) : null;

  if (!canAnalytics) {
    return (
      <>
        <PageHeader title="Visão geral" description="Indicadores do catálogo." />
        {ownStore}
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
      {ownStore}
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
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <DailyLine title="Cliques por dia" data={m.clicksByDay} valueLabel="Cliques" />
        <CommissionsChart points={m.commissionsDaily} days={days} />
        <RankBar title="Produtos mais acessados" data={m.viewsByProduct} valueLabel="Visualizações" />
        <RankBar title="Categorias mais populares (cliques)" data={m.clicksByCategory} valueLabel="Cliques" />
        <RankBar title="Cliques por plataforma de afiliados" data={m.clicksByNetwork} valueLabel="Cliques" />
        <RankBar title="Desempenho das campanhas (cliques)" data={m.clicksByCampaign} valueLabel="Cliques" />
      </div>
      <section className="panel mt-4 overflow-hidden">
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
