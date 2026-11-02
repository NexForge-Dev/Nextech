import type { EmailKind } from "@/lib/email/templates";

type CancelRow = { order_id: string; previous_status: string; payment_method: string; payment_intent: string | null; total_minor: number };

export type CancelDeps = {
  cancelInDb(orderNumber: number): Promise<CancelRow>;
  refund(paymentIntentId: string, amountMinor: number, idempotencyKey: string): Promise<void>;
  cancelPaymentIntent(paymentIntentId: string): Promise<void>;
  recordManualPending(orderId: string, amountMinor: number): Promise<void>;
  notify(kind: EmailKind, orderId: string, extra?: { refundMinor?: number }): Promise<void>;
};

export type CancelResult = { ok: true; refund: "stripe" | "manual" | "none" } | { ok: false; error: string };

const ERRORS: Record<string, string> = {
  already_purchased: "Este pedido já está sendo preparado e não pode mais ser cancelado. Abra uma solicitação de devolução ou suporte.",
  not_cancellable: "Este pedido não pode mais ser cancelado. Abra uma solicitação de devolução ou suporte.",
  order_not_found: "Pedido não encontrado.",
};

/** Customer cancellation: the database decides (and locks); then money goes back the right way. */
export async function cancelOrderWith(d: CancelDeps, orderNumber: number): Promise<CancelResult> {
  let row: CancelRow;
  try {
    row = await d.cancelInDb(orderNumber);
  } catch (e) {
    return { ok: false, error: ERRORS[e instanceof Error ? e.message : ""] ?? "Não foi possível cancelar agora. Tente novamente." };
  }
  const paid = row.previous_status !== "awaiting_payment";
  let refund: "stripe" | "manual" | "none" = "none";
  if (!paid) {
    if (row.payment_intent) await d.cancelPaymentIntent(row.payment_intent).catch(() => undefined);
  } else if (row.payment_method === "boleto") {
    await d.recordManualPending(row.order_id, row.total_minor);
    refund = "manual";
  } else if (row.payment_intent) {
    await d.refund(row.payment_intent, row.total_minor, `refund-cancel-${row.order_id}`);
    refund = "stripe";
  }
  await d.notify("orderCancelled", row.order_id, refund === "stripe" ? { refundMinor: row.total_minor } : undefined);
  if (refund === "manual") await d.notify("ownerManualRefund", row.order_id, { refundMinor: row.total_minor });
  return { ok: true, refund };
}
