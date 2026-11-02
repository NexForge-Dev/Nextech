import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { countAwaitingSupplier, countOpenReturns, listOrders, ORDERS_PAGE_SIZE } from "@/lib/data/admin/orders";
import { ADMIN_STATUS_LABEL, ORDER_STATUSES } from "@/lib/domain/order-status";
import { formatMoney } from "@/lib/domain/money";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, EmptyPanel } from "@/components/admin/data-table";

export const metadata = { title: "Pedidos" };

type Search = { q?: string; status?: string; payment?: string; from?: string; to?: string; page?: string };
const METHOD: Record<string, string> = { card: "Cartão", boleto: "Boleto", pix: "Pix" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await pageGuard("orders.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ rows, total }, awaiting, openReturns] = await Promise.all([listOrders({ ...sp, page }), countAwaitingSupplier(), countOpenReturns()]);
  const money = (m: number) => formatMoney(m, "BRL", "pt-BR");
  const select = "h-10 rounded-md border border-line bg-white px-3 text-sm";
  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Pedidos da loja própria. Compre no fornecedor, registre a compra e o rastreio em cada pedido."
        actions={
          <Link href="/admin/pedidos/devolucoes" className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-4 text-sm font-medium hover:bg-soft">
            Devoluções e suporte{openReturns > 0 && <span className="rounded-full bg-black px-2 text-xs text-white">{openReturns}</span>}
          </Link>
        }
      />
      {awaiting > 0 && (
        <Link href="/admin/pedidos?status=awaiting_supplier" className="mb-6 flex items-center justify-between rounded-md bg-black px-4 py-3 text-sm font-medium text-white" data-testid="awaiting-banner">
          <span>{awaiting === 1 ? "1 pedido aguardando compra no fornecedor" : `${awaiting} pedidos aguardando compra no fornecedor`}</span>
          <span aria-hidden>→</span>
        </Link>
      )}
      <DataTable
        rows={rows}
        total={total}
        page={page}
        pageSize={ORDERS_PAGE_SIZE}
        basePath="/admin/pedidos"
        params={{ q: sp.q, status: sp.status, payment: sp.payment, from: sp.from, to: sp.to }}
        searchPlaceholder="Nome, e-mail ou nº do pedido"
        filters={
          <>
            <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className={select}>
              <option value="">Todos os status</option>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ADMIN_STATUS_LABEL[s]}</option>)}
            </select>
            <select name="payment" defaultValue={sp.payment ?? ""} aria-label="Pagamento" className={select}>
              <option value="">Pago e não pago</option>
              <option value="paid">Pagos</option>
              <option value="unpaid">Não pagos</option>
            </select>
            <input type="date" name="from" defaultValue={sp.from ?? ""} aria-label="De" className={select} />
            <input type="date" name="to" defaultValue={sp.to ?? ""} aria-label="Até" className={select} />
          </>
        }
        empty={<EmptyPanel title={sp.q || sp.status || sp.payment ? "Nenhum pedido encontrado" : "Nenhum pedido ainda"} text="Os pedidos aparecem aqui assim que um cliente finaliza a compra." />}
        columns={[
          { key: "n", header: "#", cell: (r) => <Link href={`/admin/pedidos/${r.number}`} className="font-mono font-medium hover:underline">{r.number}</Link> },
          { key: "date", header: "Data", cell: (r) => <span className="tabular text-xs">{new Date(r.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</span> },
          { key: "cust", header: "Cliente", cell: (r) => <div><p className="font-medium">{r.customer}</p><p className="text-xs text-mute">{r.email}</p></div> },
          { key: "total", header: "Total", cell: (r) => <span className="tabular">{money(r.totalMinor)}</span> },
          { key: "pay", header: "Pagamento", cell: (r) => <span className="text-xs">{METHOD[r.paymentMethod] ?? r.paymentMethod} {r.paid ? "✓" : "⏳"}</span> },
          { key: "status", header: "Status", cell: (r) => <span className="rounded-full border border-line px-2 py-0.5 text-xs font-medium">{ADMIN_STATUS_LABEL[r.status]}</span> },
          { key: "margin", header: "Margem", cell: (r) => (r.marginMinor != null ? <span className="tabular text-xs">{money(r.marginMinor)}{r.marginPct != null ? ` (${r.marginPct}%)` : ""}</span> : <span className="text-mute">—</span>) },
        ]}
      />
    </>
  );
}
