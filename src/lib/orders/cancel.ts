import type { EmailKind } from "@/lib/email/templates";
import { formatMoney } from "@/lib/domain/money";

type CancelRow = { order_id: string; previous_status: string; payment_method: string; payment_intent: string | null; total_minor: number; refunded_minor: number };

export type CancelDeps = {
  cancelInDb(orderNumber: number): Promise<CancelRow>;
  /** false when Stripe refused or failed (the failure is already in the order history). */
  refund(paymentIntentId: string, amountMinor: number, idempotencyKey: string): Promise<boolean>;
  cancelPaymentIntent(paymentIntentId: string): Promise<void>;
  recordManualPending(orderId: string, amountMinor: number): Promise<void>;
  notify(kind: EmailKind, orderId: string, extra?: { refundMinor?: number; alert?: string }): Promise<void>;
};

type RefundKind = "stripe" | "manual" | "none" | "failed";
export type CancelResult = { ok: true; refund: RefundKind } | { ok: false; error: string };

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
  // only what is still held: an earlier partial refund already went back to the customer
  const remaining = Math.max(0, row.total_minor - (row.refunded_minor ?? 0));
  let refund: RefundKind = "none";
  if (!paid) {
    if (row.payment_intent) await d.cancelPaymentIntent(row.payment_intent).catch(() => undefined);
  } else if (remaining <= 0) {
    refund = "none";
  } else if (row.payment_method === "boleto") {
    await d.recordManualPending(row.order_id, remaining);
    refund = "manual";
  } else if (row.payment_intent) {
    refund = (await d.refund(row.payment_intent, remaining, `refund-cancel-${row.order_id}`)) ? "stripe" : "failed";
  }
  await d.notify("orderCancelled", row.order_id, refund === "stripe" ? { refundMinor: remaining } : undefined);
  if (refund === "manual") await d.notify("ownerManualRefund", row.order_id, { refundMinor: remaining });
  if (refund === "failed") {
    await d.notify("ownerAlert", row.order_id, {
      alert: `O cliente cancelou o pedido e o reembolso automático de ${formatMoney(remaining, "BRL", "pt-BR")} falhou no Stripe. Faça o reembolso pelo botão “Reembolsar” no painel.`,
    });
  }
  return { ok: true, refund };
}
