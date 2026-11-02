import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { listReturns } from "@/lib/data/admin/orders";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyPanel } from "@/components/admin/data-table";

export const metadata = { title: "Devoluções e suporte" };

const REASON: Record<string, string> = { withdrawal: "Desistência", defect: "Defeito", other: "Outro" };
const OUTCOME: Record<string, string> = { refund_full: "Reembolso total", refund_partial: "Reembolso parcial", replacement: "Troca", refused: "Recusada" };

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await pageGuard("orders.read");
  const status = (await searchParams).status === "resolved" ? "resolved" : "open";
  const rows = await listReturns(status);
  const tab = (s: "open" | "resolved", label: string) => (
    <Link href={`/admin/pedidos/devolucoes${s === "resolved" ? "?status=resolved" : ""}`} aria-current={status === s ? "page" : undefined} className={`-mb-px border-b-2 px-3 py-2 text-sm ${status === s ? "border-black font-medium" : "border-transparent text-mute hover:text-black"}`}>
      {label}
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Devoluções e suporte"
        description="Solicitações abertas pelos clientes em Meus pedidos. Resolva dentro do pedido: reembolso, troca ou recusa (com explicação)."
        actions={<Link href="/admin/pedidos" className="inline-flex h-10 items-center rounded-md border border-line px-4 text-sm font-medium hover:bg-soft">Pedidos</Link>}
      />
      <nav className="mb-6 flex gap-2 border-b border-line">{tab("open", "Abertas")}{tab("resolved", "Resolvidas")}</nav>
      {rows.length === 0 ? (
        <EmptyPanel title={status === "open" ? "Nenhuma solicitação aberta" : "Nenhuma solicitação resolvida"} />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {r.orderNumber != null ? <Link href={`/admin/pedidos/${r.orderNumber}`} className="hover:underline">Pedido #{r.orderNumber}</Link> : "Pedido removido"} · {r.customer}
                </p>
                <p className="truncate text-mute">{REASON[r.reason] ?? r.reason} — {r.message}</p>
              </div>
              <span className="text-xs text-mute">
                {new Date(r.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                {r.outcome && ` · ${OUTCOME[r.outcome]}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
