import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth/session";
import { listCustomers } from "@/lib/data/admin/customers";
import { toCsv } from "@/lib/domain/report-csv";
import { writeAudit } from "@/lib/admin/action";

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.permissions.has("customers.export")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { rows } = await listCustomers({ page: 1, pageSize: 1_000_000 });
  await writeAudit({ actorId: ctx.userId, action: "export_customers", entity: "customers", summary: { rows: rows.length } });
  const csv = toCsv(
    rows.map((r) => ({ name: r.name, email: r.email, created: r.createdAt, last: r.lastSignIn, favorites: r.favorites })),
    [{ key: "name", header: "Nome" }, { key: "email", header: "E-mail" }, { key: "created", header: "Cadastro" }, { key: "last", header: "Último acesso" }, { key: "favorites", header: "Favoritos" }],
  );
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="nextech-clientes-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
