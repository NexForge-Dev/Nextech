"use server";
import { analytics } from "@/lib/analytics";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction, ActionFailure, writeAudit } from "@/lib/admin/action";
import { requirePermission } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe/server";
import { invoiceSchema, orderItemSchema, refundSchema, resolveReturnSchema, statusSchema } from "@/lib/admin/schemas/order";
import { refundableMinor } from "@/lib/orders/admin-rules";
import { notifyOrder } from "@/lib/orders/notify";
import { issueStripeRefund, lateRefundDeps, refundClaims, stripeRefundApi } from "@/lib/orders/late-refund";
import { formatMoney } from "@/lib/domain/money";
import { adminCanSetStatus, isOrderStatus } from "@/lib/domain/order-status";

// The order tables have no RLS policies for browser roles: every admin read/write here uses the
// service role, and adminAction has already checked the orders.* permission before fn runs.

async function loadOrder(orderId: string) {
  const svc = createServiceSupabase();
  const { data } = await svc.from("orders").select("id, number, user_id, status, payment_method, total_minor, refunded_minor, paid_at, stripe_payment_intent_id, order_items(id, tracking_code, supplier_purchased_at)").eq("id", orderId).maybeSingle();
  if (!data) throw new ActionFailure("invalid", "Pedido não encontrado.");
  return data;
}

function touch(number: number) {
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${number}`);
}

const STATUS_ERRORS: Record<string, string> = {
  order_closed: "Pedido cancelado ou reembolsado: não pode mais ser alterado.",
  status_changed: "O pedido mudou enquanto você editava (ex.: o cliente cancelou). Recarregue a página.",
  missing_tracking: "Informe o código de rastreio de todos os itens antes de marcar como enviado.",
  invalid_status: "O pagamento só é confirmado pelo Stripe.",
  order_unpaid: "Pedido ainda não pago: o pagamento só é confirmado pelo Stripe. Antes disso ele só pode ser cancelado.",
  already_shipped: "Este item já foi enviado; não dá para desmarcar a compra.",
};
const dbFailure = (message: string) => new ActionFailure("invalid", STATUS_ERRORS[message] ?? message);

const statusImpl = adminAction({ permission: "orders.write", schema: statusSchema, audit: { action: "status", entity: "orders" } }, async ({ orderId, status, expected, note }, ctx) => {
  const o = await loadOrder(orderId);
  if (o.status === status) return { id: orderId, audit: { status } };
  if (isOrderStatus(o.status) && o.status === "awaiting_payment" && !adminCanSetStatus(status, o.status)) throw dbFailure("order_unpaid");
  if (status === "refunded" && Number(o.refunded_minor) < Number(o.total_minor)) {
    throw new ActionFailure("invalid", "Use “Reembolsar” para devolver o valor; o status muda sozinho quando o reembolso total é registrado.");
  }
  const trackings = status === "shipped" || status === "in_transit" ? o.order_items.map((i) => i.tracking_code) : undefined;
  // locked, conditional transition: refuses closed orders and stale reads (e.g. the customer cancelled meanwhile)
  const { error } = await createServiceSupabase().rpc("admin_set_order_status", {
    p_order: orderId,
    p_expected: expected,
    p_to: status,
    p_actor: ctx.userId,
    p_data: { note: note || null, ...(trackings ? { trackings } : {}) } as never,
  });
  if (error) throw dbFailure(error.message);
  if (status === "shipped" && o.status !== "in_transit") await notifyOrder("orderShipped", orderId);
  if (status === "delivered") await notifyOrder("orderDelivered", orderId);
  let refundNote: string | undefined;
  if (status === "cancelled") {
    if (!o.paid_at && o.stripe_payment_intent_id) await getStripe().paymentIntents.cancel(o.stripe_payment_intent_id).catch(() => undefined);
    // a paid order that is cancelled must give the money back (same rule as the customer's cancellation)
    const remaining = refundableMinor({ totalMinor: Number(o.total_minor), refundedMinor: Number(o.refunded_minor), paid: !!o.paid_at });
    if (remaining > 0 && o.payment_method === "boleto") {
      await createServiceSupabase().from("order_events").insert({ order_id: orderId, actor: "system", kind: "manual_refund_pending", data: { amount: remaining, reason: "admin_cancel" } });
      await notifyOrder("ownerManualRefund", orderId, { refundMinor: remaining });
      refundNote = "manual_refund_pending";
    } else if (remaining > 0) {
      try {
        await refundCore(orderId, remaining, "Cancelado pela loja", false, ctx.userId);
        refundNote = "stripe_refund";
      } catch {
        await notifyOrder("ownerAlert", orderId, { alert: `O pedido foi cancelado mas o reembolso automático de ${formatMoney(remaining, "BRL", "pt-BR")} falhou. Use “Reembolsar” no painel.` });
        refundNote = "refund_failed";
      }
    }
    await notifyOrder("orderCancelled", orderId, refundNote === "stripe_refund" ? { refundMinor: remaining } : undefined);
  }
  touch(Number(o.number));
  return { id: orderId, audit: { from: o.status, to: status, ...(refundNote ? { refund: refundNote } : {}) } };
});
export async function updateOrderStatus(input: unknown) {
  return statusImpl(input);
}

const itemImpl = adminAction({ permission: "orders.write", schema: orderItemSchema, audit: { action: "item", entity: "order_items" } }, async (v, ctx) => {
  const svc = createServiceSupabase();
  const { data: item } = await svc.from("order_items").select("order_id, orders(number)").eq("id", v.itemId).maybeSingle();
  if (!item || !item.orders) throw new ActionFailure("invalid", "Item não encontrado.");
  // one locked transaction: refuses cancelled/refunded orders, moves the order forward on the first purchase
  const { error } = await svc.rpc("admin_update_order_item", {
    p_item: v.itemId,
    p_patch: {
      supplierId: v.supplierId,
      supplierCostMinor: v.supplierCostMinor,
      supplierOrderRef: v.supplierOrderRef,
      supplierUrl: v.supplierUrl,
      trackingCarrier: v.trackingCarrier,
      trackingCode: v.trackingCode,
      trackingUrl: v.trackingUrl,
      purchased: v.purchased,
    } as never,
    p_actor: ctx.userId,
  });
  if (error) throw dbFailure(error.message);
  touch(Number(item.orders.number));
  return { id: v.itemId, audit: { purchased: v.purchased, tracking: !!v.trackingCode } };
});
export async function updateOrderItem(input: unknown) {
  return itemImpl(input);
}

const REFUND_BUSY = "Já há um reembolso em andamento neste pedido. Aguarde um instante e confira o saldo.";

async function refundCore(orderId: string, amountMinor: number, note: string, manual: boolean, actorId: string) {
  const o = await loadOrder(orderId);
  const max = refundableMinor({ totalMinor: Number(o.total_minor), refundedMinor: Number(o.refunded_minor), paid: !!o.paid_at });
  if (max <= 0) throw new ActionFailure("invalid", "Não há valor pago para reembolsar.");
  if (amountMinor > max) throw new ActionFailure("invalid", `O máximo reembolsável é ${formatMoney(max, "BRL", "pt-BR")}.`);
  const svc = createServiceSupabase();
  let confirmed = true;
  if (o.payment_method === "boleto" || manual) {
    if (!manual) throw new ActionFailure("invalid", "Pedidos pagos com boleto são reembolsados por fora (Pix ou transferência). Marque “Reembolsado por fora”.");
    const claims = refundClaims(svc);
    const token = await claims.claim(orderId, "admin");
    if (!token) throw new ActionFailure("invalid", REFUND_BUSY);
    try {
      const { error } = await svc.rpc("order_record_refund", { p_order: orderId, p_pi: null as never, p_amount: amountMinor, p_method: "manual", p_stripe_refund: null as never, p_status: "succeeded", p_note: (note || "Reembolsado por fora") as never, p_actor: actorId });
      if (error) throw new ActionFailure("invalid", error.message === "refund_exceeds_total" ? "Valor maior que o pago." : error.message);
    } finally {
      await claims.release(orderId, token);
    }
    // Stripe refunds reach the panel through the webhook. The amount already refunded tells this one apart.
    analytics.refund(o.user_id, orderId, `manual:${orderId}:${o.refunded_minor}`, { amountMinor, full: amountMinor >= Number(o.total_minor), method: "manual" });
  } else {
    if (!o.stripe_payment_intent_id) throw new ActionFailure("invalid", "Pedido sem pagamento no Stripe.");
    const r = await issueStripeRefund(lateRefundDeps(svc, stripeRefundApi(getStripe()), notifyOrder), { orderId, paymentIntent: o.stripe_payment_intent_id, source: "admin", amountMinor, note: note || undefined, actorId });
    if (r.outcome === "busy") throw new ActionFailure("invalid", REFUND_BUSY);
    if (r.outcome === "nothing_owed") throw new ActionFailure("invalid", "Não há valor pago para reembolsar.");
    if (r.outcome === "exceeds") throw new ActionFailure("invalid", `O máximo reembolsável agora é ${formatMoney(r.availableMinor, "BRL", "pt-BR")}: há reembolso em processamento.`);
    if (r.outcome !== "created") throw new ActionFailure("invalid", REFUND_BUSY);
    confirmed = r.confirmed;
  }
  // a refund still processing is announced by the webhook, when Stripe confirms it
  if (confirmed) await notifyOrder("orderRefunded", orderId, { refundMinor: amountMinor });
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
  // claim the request first (conditional on still open) so two clicks can never refund twice
  const { data: claimed, error } = await svc
    .from("return_requests")
    .update({ status: "resolved", outcome: v.outcome, outcome_note: v.note || null, resolved_at: new Date().toISOString() })
    .eq("id", v.returnId)
    .eq("status", "open")
    .select("id");
  if (error) throw error;
  if (!claimed?.length) throw new ActionFailure("invalid", "Esta solicitação já foi resolvida.");
  if (v.outcome === "refund_full" || v.outcome === "refund_partial") {
    const amount = v.outcome === "refund_full" ? Number(rr.orders.total_minor) - Number(rr.orders.refunded_minor) : v.refundAmountMinor!;
    try {
      await refundCore(rr.order_id, amount, v.note || "Devolução", rr.orders.payment_method === "boleto", ctx.userId);
    } catch (e) {
      // reopen so the admin can try again
      await svc.from("return_requests").update({ status: "open", outcome: null, outcome_note: null, resolved_at: null }).eq("id", v.returnId);
      throw e;
    }
  }
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
  // the declared type comes from the browser: check the PDF signature too
  if (new TextDecoder().decode(new Uint8Array(await file.slice(0, 5).arrayBuffer())) !== "%PDF-") return { ok: false, error: "A nota precisa ser um PDF." };
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
const fileRefSchema = z.object({ bucket: z.enum(["invoices", "returns"]), path: z.string().max(300).regex(/^[0-9a-f-]{36}\/[\w.-]+$/) });

export async function adminFileUrl(bucket: "invoices" | "returns", path: string): Promise<string | null> {
  await requirePermission("orders.read");
  // server actions are public endpoints: the TypeScript union is not a runtime check
  const ref = fileRefSchema.safeParse({ bucket, path });
  if (!ref.success) return null;
  const { data } = await createServiceSupabase().storage.from(bucket).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

