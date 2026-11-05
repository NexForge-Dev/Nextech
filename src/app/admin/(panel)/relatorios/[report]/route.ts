import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext } from "@/lib/auth/session";
import { parsePeriod } from "@/lib/domain/period";
import { toCsv } from "@/lib/domain/report-csv";
import { REPORTS } from "@/lib/admin/reports";
import { writeAudit } from "@/lib/admin/action";

export async function GET(req: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.permissions.has("analytics.read")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { report } = await params;
  const def = REPORTS[report];
  if (!def) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (def.permission && !ctx.permissions.has(def.permission)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const period = parsePeriod(sp);
  const uuid = (k: string) => (/^[0-9a-f-]{36}$/i.test(sp.get(k) ?? "") ? sp.get(k)! : undefined);
  const rows = await def.load(period, { product: uuid("product"), category: uuid("category"), campaign: uuid("campaign"), network: uuid("network") });
  await writeAudit({ actorId: ctx.userId, action: "export_report", entity: "reports", entityId: report, summary: { rows: rows.length, from: period.fromDate, to: period.toDate } });
  return new NextResponse(toCsv(rows, def.columns), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nextech-${report}-${period.fromDate}-a-${period.toDate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
