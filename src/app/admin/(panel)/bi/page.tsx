import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { parsePeriod } from "@/lib/domain/period";
import { formatMoney } from "@/lib/domain/money";
import { getSalesBi } from "@/lib/data/admin/sales-bi";
import { PageHeader } from "@/components/admin/page-header";
import { PeriodFilter } from "@/components/admin/period-filter";
import { DailyLine, KpiCard, RankBar } from "@/components/admin/charts";
import type { BiRow } from "@/lib/domain/sales-bi";

export const metadata = { title: "BI de vendas" };

const REFUND_STATUS: Record<string, string> = { succeeded: "Concluído", pending: "Em andamento", failed: "Falhou", canceled: "Cancelado" };
const REFUND_METHOD: Record<string, string> = { stripe: "Stripe", manual: "Por fora" };
const money = (minor: number) => formatMoney(minor, "BRL", "pt-BR");
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);
const byUnits = (rows: BiRow[]) => rows.map((r) => ({ label: r.label, value: r.units }));
const byRevenue = (rows: BiRow[]) => [...rows].sort((a, b) => b.revenueMinor - a.revenueMinor).map((r) => ({ label: r.label, value: Math.round(r.revenueMinor / 100) }));

function RowsTable({ title, rows, first }: { title: string; rows: BiRow[]; first: string }) {
  if (!rows.length) return null;
  const head = "px-4 py-2 text-right font-medium";
  return (
    <section className="panel mt-4 overflow-x-auto">
      <h2 className="px-4 pt-4 font-medium">{title}</h2>
      <table className="mt-2 w-full min-w-[720px] text-sm">
        <thead className="text-xs text-mute">
          <tr className="border-b border-line">
            <th className="px-4 py-2 text-left font-medium">{first}</th>
            <th className={head}>Unidades</th>
            <th className={head}>Pedidos</th>
            <th className={head}>Receita</th>
            <th className={head}>Reembolsado</th>
            <th className={head}>Pedidos reembolsados</th>
            <th className={head}>Custo registrado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line last:border-0">
              <td className="max-w-72 truncate px-4 py-2" title={r.label}>{r.label}</td>
              <td className="tabular px-4 py-2 text-right">{r.units}</td>
              <td className="tabular px-4 py-2 text-right">{r.orders}</td>
              <td className="tabular px-4 py-2 text-right">{money(r.revenueMinor)}</td>
              <td className="tabular px-4 py-2 text-right">{r.refundedMinor ? money(r.refundedMinor) : "—"}</td>
              <td className="tabular px-4 py-2 text-right">{r.refundedOrders || "—"}</td>
              <td className="tabular px-4 py-2 text-right">{r.costMinor == null ? "—" : money(r.costMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function SalesBiPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageGuard("orders.read");
  const raw = await searchParams;
  const sp = new URLSearchParams(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string"));
  const period = parsePeriod(sp);
  const bi = await getSalesBi(period);
  const t = bi.totals;
  return (
    <>
      <PageHeader title="BI de vendas" description="Produtos e categorias mais vendidos, reembolsos e receita da loja. Pedidos contam no dia do pagamento; reembolsos, no dia em que aconteceram. Exporte em Relatórios." />
      <PeriodFilter current={period.key} from={period.fromDate} to={period.toDate} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Receita bruta" value={money(t.grossMinor)} hint={`${t.orders} ${t.orders === 1 ? "pedido pago" : "pedidos pagos"}`} />
        <KpiCard label="Receita líquida" value={money(t.netMinor)} hint="Bruta menos reembolsos" />
        <KpiCard label="Unidades vendidas" value={String(t.units)} hint={`Ticket médio ${t.averageTicketMinor == null ? "—" : money(t.averageTicketMinor)}`} />
        <KpiCard label="Compradores" value={String(t.buyers)} hint={`${t.repeatBuyers} com mais de uma compra`} />
        <KpiCard label="Reembolsos" value={String(t.refunds)} hint={t.pendingRefunds ? `${t.pendingRefunds} em andamento` : "Concluídos no período"} />
        <KpiCard label="Valor reembolsado" value={money(t.refundedMinor)} hint={`${t.refundedOrders} ${t.refundedOrders === 1 ? "pedido" : "pedidos"}`} />
        <KpiCard label="Taxa de reembolso" value={pct(t.refundRate)} hint="Pedidos reembolsados ÷ pedidos pagos" />
        <KpiCard
          label="Margem estimada"
          value={t.marginMinor == null ? "—" : money(t.marginMinor)}
          hint={t.lines ? `Custo registrado em ${t.linesWithCost} de ${t.lines} itens; antes das taxas (${money(t.feesMinor)})` : "Registre o custo em cada pedido"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <RankBar title="Produtos mais vendidos" data={byUnits(bi.products)} valueLabel="Unidades" />
        <RankBar title="Produtos que mais faturam (R$)" data={byRevenue(bi.products)} valueLabel="Receita em reais" />
        <RankBar title="Categorias mais vendidas" data={byUnits(bi.categories)} valueLabel="Unidades" />
        <RankBar title="Categorias que mais faturam (R$)" data={byRevenue(bi.categories)} valueLabel="Receita em reais" />
        <RankBar title="Marcas mais vendidas" data={byUnits(bi.brands)} valueLabel="Unidades" />
        <RankBar title="Formas de pagamento (R$)" data={byRevenue(bi.methods)} valueLabel="Receita em reais" />
        <DailyLine title="Receita por dia (R$)" data={bi.revenueByDay} valueLabel="Receita em reais" />
        <DailyLine title="Unidades por dia" data={bi.unitsByDay} valueLabel="Unidades" />
        <DailyLine title="Reembolsos por dia" data={bi.refundsByDay} valueLabel="Reembolsos" />
      </div>

      <RowsTable title="Todos os produtos vendidos" rows={bi.products} first="Produto" />
      <RowsTable title="Categorias" rows={bi.categories} first="Categoria" />

      <section className="panel mt-4 overflow-x-auto">
        <h2 className="px-4 pt-4 font-medium">Reembolsos do período</h2>
        {bi.refunds.length === 0 ? (
          <p className="px-4 pb-4 pt-2 text-sm text-mute">Nenhum reembolso no período.</p>
        ) : (
          <table className="mt-2 w-full min-w-[560px] text-sm">
            <thead className="text-xs text-mute">
              <tr className="border-b border-line">
                <th className="px-4 py-2 text-left font-medium">Pedido</th>
                <th className="px-4 py-2 text-left font-medium">Data</th>
                <th className="px-4 py-2 text-left font-medium">Forma</th>
                <th className="px-4 py-2 text-left font-medium">Situação</th>
                <th className="px-4 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {bi.refunds.slice(0, 50).map((r, i) => (
                <tr key={`${r.orderId}-${r.createdAt}-${i}`} className="border-b border-line last:border-0">
                  <td className="px-4 py-2"><Link href={`/admin/pedidos/${r.orderNumber}`} className="underline">#{r.orderNumber}</Link></td>
                  <td className="tabular px-4 py-2">{new Date(r.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                  <td className="px-4 py-2">{REFUND_METHOD[r.method] ?? r.method}</td>
                  <td className="px-4 py-2">{REFUND_STATUS[r.status] ?? r.status}</td>
                  <td className="tabular px-4 py-2 text-right">{money(r.amountMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
