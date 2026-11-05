import { MAX_REFUND_ATTEMPTS, type UnsettledRefund } from "./late-refund";

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
  const owedMessage = (o: UnsettledRefund) => {
    const amount = money(o.outstandingMinor);
    if (o.disputed) return `Pedido cancelado com ${amount} a devolver e contestação no Stripe. Resolva a contestação antes de devolver.`;
    if (o.paymentMethod === "boleto") return `Pedido cancelado com ${amount} a devolver por Pix ou transferência.`;
    return `Pedido cancelado com ${amount} ainda não devolvidos ao cliente${o.attempts >= MAX_REFUND_ATTEMPTS ? ", e as tentativas automáticas acabaram" : ""}. Confira e use “Reembolsar” no pedido.`;
  };
  const owedAlerts = owed.map((o): OrderAlert => ({ key: `owed:${o.orderId}`, number: o.number, message: owedMessage(o), emailed: null }));
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
