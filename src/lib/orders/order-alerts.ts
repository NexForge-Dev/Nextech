import type { UnsettledRefund } from "./late-refund";

export type AlertEvent = {
  orderId: string;
  number: number;
  at: string;
  data: { template?: string; alert?: string | null; refundMinor?: number | null; emailed?: boolean };
  /** The whole order was refunded, so an alert about giving money back no longer applies. */
  settled: boolean;
};

export type OrderAlert = { key: string; number: number; message: string; emailed: boolean | null };

const REFUND_TEMPLATES = ["ownerManualRefund"];

function eventMessage(e: AlertEvent, money: (m: number) => string): string {
  if (e.data.alert) return e.data.alert;
  if (e.data.template === "ownerDispute") return "Contestação aberta no Stripe: responda dentro do prazo.";
  return `Reembolso por fora pendente${e.data.refundMinor ? ` de ${money(e.data.refundMinor)}` : ""}: devolva por Pix ou transferência e registre no pedido.`;
}

/**
 * Money still owed comes first and stays until paid back. Other alerts show once per order and
 * message, newest first; refund alerts disappear as soon as the order is fully refunded.
 */
export function orderAlertsFrom(owed: UnsettledRefund[], events: AlertEvent[], money: (m: number) => string): OrderAlert[] {
  const owedAlerts = owed.map((o): OrderAlert => ({
    key: `owed:${o.orderId}`,
    number: o.number,
    message: o.paymentMethod === "boleto" ? `Pedido cancelado com ${money(o.outstandingMinor)} a devolver por Pix ou transferência.` : `Pedido cancelado com ${money(o.outstandingMinor)} ainda não devolvidos ao cliente. O reembolso é tentado de novo todo dia; se preferir, use “Reembolsar”.`,
    emailed: null,
  }));
  const owedIds = new Set(owed.map((o) => o.orderId));
  const seen = new Set<string>();
  const eventAlerts = events.flatMap((e): OrderAlert[] => {
    const isRefund = REFUND_TEMPLATES.includes(e.data.template ?? "") || /reembolso/i.test(e.data.alert ?? "");
    if (isRefund && (e.settled || owedIds.has(e.orderId))) return [];
    const message = eventMessage(e, money);
    const key = `${e.orderId}:${message}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ key, number: e.number, message, emailed: e.data.emailed ?? null }];
  });
  return [...owedAlerts, ...eventAlerts];
}
