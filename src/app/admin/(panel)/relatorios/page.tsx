import { Download } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { parsePeriod } from "@/lib/domain/period";
import { PageHeader } from "@/components/admin/page-header";
import { PeriodFilter } from "@/components/admin/period-filter";
import { REPORTS } from "@/lib/admin/reports";

export const metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageGuard("analytics.read");
  const raw = await searchParams;
  const sp = new URLSearchParams(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string"));
  const period = parsePeriod(sp);
  const qs = new URLSearchParams({ p: period.key, ...(period.key === "custom" ? { from: period.fromDate, to: period.toDate } : {}) }).toString();
  return (
    <>
      <PageHeader title="Relatórios" description="Exportações em CSV (separador “;”, UTF-8) prontas para Excel ou Google Planilhas. Use o Analytics para filtrar por produto, categoria, campanha e rede." />
      <PeriodFilter current={period.key} from={period.fromDate} to={period.toDate} />
      <ul className="grid gap-3 md:grid-cols-2">
        {Object.entries(REPORTS).map(([key, r]) => (
          <li key={key} className="flex items-start justify-between gap-4 rounded-md border border-line p-5">
            <div>
              <p className="font-medium">{r.title}</p>
              <p className="mt-1 text-sm text-mute">{r.description}</p>
            </div>
            <a href={`/admin/relatorios/${key}?${qs}`} download className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium hover:bg-soft">
              <Download className="size-4" /> CSV
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
