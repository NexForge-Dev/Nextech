"use server";
import { revalidatePath } from "next/cache";
import { adminAction, ActionFailure, writeAudit } from "@/lib/admin/action";
import { requirePermission } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe/server";
import { invoiceSchema, orderItemSchema, refundSchema, resolveReturnSchema, statusSchema } from "@/lib/admin/schemas/order";
import { canShip, refundableMinor } from "@/lib/orders/admin-rules";
import { notifyOrder } from "@/lib/orders/notify";
import { formatMoney } from "@/lib/domain/money";

// The order tables have no RLS policies for browser roles: every admin read/write here uses the
// service role, and adminAction has already checked the orders.* permission before fn runs.

async function loadOrder(orderId: string) {
  const svc = createServiceSupabase();
  const { data } = await svc.from("orders").select("id, number, status, payment_method, total_minor, refunded_minor, paid_at, stripe_payment_intent_id, order_items(id, tracking_code, supplier_purchased_at)").eq("id", orderId).maybeSingle();
  if (!data) throw new ActionFailure("invalid", "Pedido não encontrado.");
  return data;
}

function touch(number: number) {
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${number}`);
}

const statusImpl = adminAction({ permission: "orders.write", schema: statusSchema, audit: { action: "status", entity: "orders" } }, async ({ orderId, status, note }, ctx) => {
  const o = await loadOrder(orderId);
  if (o.status === status) return { id: orderId, audit: { status } };
  if ((status === "shipped" || status === "in_transit" || status === "delivered") && !canShip(o.order_items.map((i) => ({ trackingCode: i.tracking_code })))) {
    throw new ActionFailure("invalid", "Informe o código de rastreio de todos os itens antes de marcar como enviado.");
  }
  if (status === "refunded" && Number(o.refunded_minor) < Number(o.total_minor)) {
    throw new ActionFailure("invalid", "Use “Reembolsar” para devolver o valor; o status muda sozinho quando o reembolso total é registrado.");
  }
  const svc = createServiceSupabase();
  const { error } = await svc.from("orders").update({ status, ...(status === "cancelled" ? { cancelled_at: new Date().toISOString() } : {}) }).eq("id", orderId);
  if (error) throw error;
  const kind = status === "shipped" || status === "in_transit" ? "shipped" : status === "delivered" ? "delivered" : status === "cancelled" ? "cancelled" : "status_changed";
  const trackings = kind === "shipped" ? o.order_items.map((i) => i.tracking_code) : undefined;
  await svc.from("order_events").insert({ order_id: orderId, actor: "admin", actor_id: ctx.userId, kind, data: { from: o.status, to: status, note: note || null, ...(trackings ? { trackings } : {}) } });
  if (status === "shipped" && o.status !== "in_transit") await notifyOrder("orderShipped", orderId);
  if (status === "delivered") await notifyOrder("orderDelivered", orderId);
  if (status === "cancelled") await notifyOrder("orderCancelled", orderId);
  touch(Number(o.number));
  return { id: orderId, audit: { from: o.status, to: status } };
});
export async function updateOrderStatus(input: unknown) {
  return statusImpl(input);
}

const itemImpl = adminAction({ permission: "orders.write", schema: orderItemSchema, audit: { action: "item", entity: "order_items" } }, async (v, ctx) => {
  const svc = createServiceSupabase();
  const { data: item } = await svc.from("order_items").select("id, order_id, supplier_purchased_at, orders(number, status)").eq("id", v.itemId).maybeSingle();
  if (!item || !item.orders) throw new ActionFailure("invalid", "Item não encontrado.");
  const order = item.orders;
  const purchasedAt = v.purchased ? (item.supplier_purchased_at ?? new Date().toISOString()) : null;
  if (!v.purchased && item.supplier_purchased_at && ["shipped", "in_transit", "delivered"].includes(order.status)) {
    throw new ActionFailure("invalid", "Este item já foi enviado; não dá para desmarcar a compra.");
  }
  const { error } = await svc
    .from("order_items")
    .update({
      supplier_id: v.supplierId,
      supplier_cost_minor: v.supplierCostMinor,
      supplier_order_ref: v.supplierOrderRef,
      supplier_url: v.supplierUrl,
      supplier_purchased_at: purchasedAt,
      tracking_carrier: v.trackingCarrier,
      tracking_code: v.trackingCode,
      tracking_url: v.trackingUrl,
    })
    .eq("id", v.itemId);
  if (error) throw error;
  if (v.purchased && !item.supplier_purchased_at) {
    await svc.from("order_events").insert({ order_id: item.order_id, actor: "admin", actor_id: ctx.userId, kind: "supplier_purchase", data: { item: v.itemId, cost: v.supplierCostMinor, ref: v.supplierOrderRef } });
    if (order.status === "paid" || order.status === "awaiting_supplier") {
      await svc.from("orders").update({ status: "supplier_purchased" }).eq("id", item.order_id);
      await svc.from("order_events").insert({ order_id: item.order_id, actor: "admin", actor_id: ctx.userId, kind: "status_changed", data: { from: order.status, to: "supplier_purchased" } });
    }
  } else {
    await svc.from("order_events").insert({ order_id: item.order_id, actor: "admin", actor_id: ctx.userId, kind: "item_updated", data: { item: v.itemId, tracking: v.trackingCode } });
  }
  touch(Number(order.number));
  return { id: v.itemId, audit: { purchased: v.purchased, tracking: !!v.trackingCode } };
});
export async function updateOrderItem(input: unknown) {
  return itemImpl(input);
}

async function refundCore(orderId: string, amountMinor: number, note: string, manual: boolean, actorId: string) {
  const o = await loadOrder(orderId);
  const max = refundableMinor({ totalMinor: Number(o.total_minor), refundedMinor: Number(o.refunded_minor), paid: !!o.paid_at });
  if (max <= 0) throw new ActionFailure("invalid", "Não há valor pago para reembolsar.");
  if (amountMinor > max) throw new ActionFailure("invalid", `O máximo reembolsável é ${formatMoney(max, "BRL", "pt-BR")}.`);
  const svc = createServiceSupabase();
  if (o.payment_method === "boleto" || manual) {
    if (!manual) throw new ActionFailure("invalid", "Pedidos pagos com boleto são reembolsados por fora (Pix ou transferência). Marque “Reembolsado por fora”.");
    const { error } = await svc.rpc("order_record_refund", { p_order: orderId, p_pi: null as never, p_amount: amountMinor, p_method: "manual", p_stripe_refund: null as never, p_status: "succeeded", p_note: (note || "Reembolsado por fora") as never, p_actor: actorId });
    if (error) throw new ActionFailure("invalid", error.message === "refund_exceeds_total" ? "Valor maior que o pago." : error.message);
  } else {
    if (!o.stripe_payment_intent_id) throw new ActionFailure("invalid", "Pedido sem pagamento no Stripe.");
    const refund = await getStripe().refunds.create(
      { payment_intent: o.stripe_payment_intent_id, amount: amountMinor, metadata: { order_id: orderId, source: "admin" } },
      { idempotencyKey: `refund-${orderId}-${o.refunded_minor}-${amountMinor}` },
    );
    const { error } = await svc.rpc("order_record_refund", { p_order: orderId, p_pi: null as never, p_amount: amountMinor, p_method: "stripe", p_stripe_refund: refund.id, p_status: refund.status === "succeeded" ? "succeeded" : "pending", p_note: (note || null) as never, p_actor: actorId });
    if (error) throw error;
  }
  await notifyOrder("orderRefunded", orderId, { refundMinor: amountMinor });
  touch(Number(o.number));
  return o;
}

const refundImpl = adminAction({ permission: "orders.refund", schema: refundSchema, audit: { action: "refund", entity: "orders" } }, async (v, ctx) => {
  await refundCore(v.orderId, v.amountMinor, v.note, v.manual, ctx.userId);
  return { id: v.orderId, audit: { amount: v.amountMinor, manual: v.manual } };
});
export async function refundOrder(input: unknown) {
  return refundImpl(input);
}

const resolveImpl = adminAction({ permission: "orders.write", schema: resolveReturnSchema, audit: { action: "resolve", entity: "return_requests" } }, async (v, ctx) => {
  const svc = createServiceSupabase();
  const { data: rr } = await svc.from("return_requests").select("id, order_id, status, orders(payment_method, total_minor, refunded_minor)").eq("id", v.returnId).maybeSingle();
  if (!rr || !rr.orders) throw new ActionFailure("invalid", "Solicitação não encontrada.");
  if (rr.status === "resolved") throw new ActionFailure("invalid", "Esta solicitação já foi resolvida.");
  if (v.outcome === "refund_full" || v.outcome === "refund_partial") {
    const amount = v.outcome === "refund_full" ? Number(rr.orders.total_minor) - Number(rr.orders.refunded_minor) : v.refundAmountMinor!;
    await refundCore(rr.order_id, amount, v.note || "Devolução", rr.orders.payment_method === "boleto", ctx.userId);
  }
  const { error } = await svc.from("return_requests").update({ status: "resolved", outcome: v.outcome, outcome_note: v.note || null, resolved_at: new Date().toISOString() }).eq("id", v.returnId);
  if (error) throw error;
  await svc.from("order_events").insert({ order_id: rr.order_id, actor: "admin", actor_id: ctx.userId, kind: "return_resolved", data: { outcome: v.outcome } });
  const label = { refund_full: "reembolso total", refund_partial: "reembolso parcial", replacement: "troca do produto", refused: "solicitação não aprovada" }[v.outcome];
  await notifyOrder("returnResolved", rr.order_id, { outcome: v.note ? `${label} — ${v.note}` : label });
  revalidatePath("/admin/pedidos/devolucoes");
  return { id: v.returnId, audit: { outcome: v.outcome } };
});
export async function resolveReturn(input: unknown) {
  return resolveImpl(input);
}

/** Attach the nota fiscal (PDF ≤ 5 MB) to an order. */
export async function attachInvoice(form: FormData): Promise<{ ok: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await requirePermission("orders.write");
  } catch {
    return { ok: false, error: "Você não tem permissão para isso." };
  }
  const parsed = invoiceSchema.safeParse({ orderId: form.get("orderId") });
  const file = form.get("file");
  if (!parsed.success || !(file instanceof File)) return { ok: false, error: "Envie um arquivo PDF." };
  if (file.type !== "application/pdf") return { ok: false, error: "A nota precisa ser um PDF." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "O PDF pode ter até 5 MB." };
  const svc = createServiceSupabase();
  const o = await loadOrder(parsed.data.orderId).catch(() => null);
  if (!o) return { ok: false, error: "Pedido não encontrado." };
  const path = `${o.id}/${crypto.randomUUID()}.pdf`;
  const { error } = await svc.storage.from("invoices").upload(path, file, { contentType: "application/pdf" });
  if (error) return { ok: false, error: "Não foi possível enviar o arquivo." };
  await svc.from("orders").update({ invoice_path: path }).eq("id", o.id);
  await svc.from("order_events").insert({ order_id: o.id, actor: "admin", actor_id: ctx.userId, kind: "invoice_attached", data: {} });
  await writeAudit({ actorId: ctx.userId, action: "invoice", entity: "orders", entityId: o.id, summary: { size: file.size } });
  touch(Number(o.number));
  return { ok: true };
}

/** Signed link (5 min) for the admin to view an attached invoice or a return photo. */
export async function adminFileUrl(bucket: "invoices" | "returns", path: string): Promise<string | null> {
  await requirePermission("orders.read");
  const { data } = await createServiceSupabase().storage.from(bucket).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

