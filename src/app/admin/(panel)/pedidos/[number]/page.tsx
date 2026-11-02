import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/admin/guard";
import { getOrderAdmin } from "@/lib/data/admin/orders";
import { ADMIN_STATUS_LABEL } from "@/lib/domain/order-status";
import { PageHeader } from "@/components/admin/page-header";
import { AdminOrderView } from "@/components/admin/order-detail";

export const metadata = { title: "Pedido" };

export default async function AdminOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const ctx = await pageGuard("orders.read");
  const order = await getOrderAdmin(Number((await params).number));
  if (!order) notFound();
  return (
    <>
      <PageHeader
        title={`Pedido #${order.number}`}
        description={`${new Date(order.createdAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })} · ${ADMIN_STATUS_LABEL[order.status]}`}
        actions={<Link href="/admin/pedidos" className="inline-flex h-10 items-center rounded-md border border-line px-4 text-sm font-medium hover:bg-soft">Todos os pedidos</Link>}
      />
      <AdminOrderView order={order} canWrite={ctx.permissions.has("orders.write")} canRefund={ctx.permissions.has("orders.refund")} />
    </>
  );
}
