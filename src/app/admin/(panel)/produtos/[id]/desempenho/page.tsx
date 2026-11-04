import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { parsePeriod } from "@/lib/domain/period";
import { formatCurrencyAmounts } from "@/lib/domain/aggregates";
import { getMetrics } from "@/lib/data/admin/metrics";
import { PageHeader } from "@/components/admin/page-header";
import { PeriodFilter } from "@/components/admin/period-filter";
import { CommissionsChart, DailyLine, KpiCard, RankBar } from "@/components/admin/charts";

export const metadata = { title: "Desempenho do produto" };

export default async function ProductPerformancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await pageGuard("analytics.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createServerSupabase();
  const { data: p } = await sb.from("products").select("id, slug, product_translations(locale, name)").eq("id", id).maybeSingle();
  if (!p) notFound();
  const sp = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => typeof e[1] === "string"));
  const period = parsePeriod(sp);
  const m = await getMetrics(period, { product: id });
  const name = p.product_translations.find((t) => t.locale === "pt-BR")?.name ?? p.slug;
  return (
    <>
      <PageHeader title={name} description={<>Desempenho do produto · <Link href={`/admin/produtos/${id}`} className="underline">editar</Link></>} />
      <PeriodFilter current={period.key} from={period.fromDate} to={period.toDate} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Visualizações" value={String(m.totalViews)} />
        <KpiCard label="Cliques" value={String(m.totalClicks)} />
        <KpiCard label="Taxa de cliques" value={m.ctr != null ? `${(m.ctr * 100).toFixed(1).replace(".", ",")}%` : "—"} />
        <KpiCard label="Conversões reportadas" value={String(m.conversions)} hint="Atribuídas pelo sub-ID do clique" />
        <KpiCard label="Comissões estimadas" value={formatCurrencyAmounts(m.commissions.pending, "pt-BR")} />
        <KpiCard label="Comissões confirmadas" value={formatCurrencyAmounts(m.commissions.confirmed, "pt-BR")} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <DailyLine title="Visualizações por dia" data={m.viewsByDay} valueLabel="Visualizações" />
        <DailyLine title="Cliques por dia" data={m.clicksByDay} valueLabel="Cliques" />
        <RankBar title="Cliques por loja" data={m.clicksByStore} valueLabel="Cliques" />
        <CommissionsChart points={m.commissionsDaily} days={m.clicksByDay.map((d) => d.key)} />
      </div>
    </>
  );
}
