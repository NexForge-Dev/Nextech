import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { formatMoney } from "@/lib/domain/money";
import { log } from "@/lib/log";
import { listStalePendingRefunds, listUnsettledRefunds, MAX_REFUND_ATTEMPTS, reconcileRefunds, settleLateRefund, type LateRefundDeps } from "./late-refund";

export type SweepConfig = { enabled: boolean; maxOrders: number; maxMinor: number };

const DEFAULT_MAX_ORDERS = 5;
const DEFAULT_MAX_MINOR = 200_000;
/** Alerts per run while listing: the panel shows everything, the mailbox should not get all of it at once. */
const MAX_ALERTS = 20;

const positive = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v?.trim() && Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * Moving money with nobody looking needs an explicit yes: AUTO_REFUND_SWEEP=on. Without a webhook
 * secret a refund could not be confirmed, so the sweep stays off whatever the switch says.
 */
export function sweepConfig(env: Record<string, string | undefined>, canConfirmRefunds: boolean): SweepConfig {
  return {
    enabled: canConfirmRefunds && ["on", "true", "1"].includes((env.AUTO_REFUND_SWEEP ?? "").trim().toLowerCase()),
    maxOrders: positive(env.AUTO_REFUND_MAX_ORDERS, DEFAULT_MAX_ORDERS),
    maxMinor: positive(env.AUTO_REFUND_MAX_MINOR, DEFAULT_MAX_MINOR),
  };
}

export type SweepResult = { mode: "off" | "on"; owed: number; owedMinor: number; refunded: number; refundedMinor: number; failed: number; left: number };

/**
 * Daily pass over what cancelled orders still owe. Asks Stripe about stale refunds in any mode, since
 * that moves no money and a lost webhook must not hide a debt. Off, it only lists and alerts, once per
 * order; every order stays in the admin panel, where one click refunds it. On, it refunds within the
 * run's caps, and an order that does not fit waits for the panel or the next run. A disputed order or
 * one out of attempts is never touched. Value counts as spent when the refund is attempted, so even a
 * failed or unconfirmed attempt cannot make the run exceed its cap.
 */
export async function sweepOwedRefunds(svc: SupabaseClient<Database>, d: LateRefundDeps, config: SweepConfig, stripeAvailable: boolean): Promise<SweepResult> {
  if (stripeAvailable) {
    for (const r of await listStalePendingRefunds(svc)) {
      await reconcileRefunds(d, r.orderId, r.paymentIntent).catch((e: unknown) => log.error("cron.refund_reconcile_failed", e, { orderId: r.orderId }));
    }
  }
  const owed = await listUnsettledRefunds(svc);
  const result: SweepResult = { mode: config.enabled ? "on" : "off", owed: owed.length, owedMinor: owed.reduce((sum, o) => sum + o.outstandingMinor, 0), refunded: 0, refundedMinor: 0, failed: 0, left: 0 };
  let attempted = 0;
  let spentMinor = 0;
  let alerts = 0;

  for (const o of owed) {
    const money = o.paymentMethod !== "boleto" && !o.disputed && o.attempts < MAX_REFUND_ATTEMPTS;
    const fits = attempted < config.maxOrders && spentMinor + o.outstandingMinor <= config.maxMinor;
    if (config.enabled && stripeAvailable && money && fits) {
      attempted += 1;
      spentMinor += o.outstandingMinor;
      try {
        const outcome = await settleLateRefund(d, o.orderId, undefined, { source: "cron", limitMinor: o.outstandingMinor });
        if (outcome === "refunded") {
          result.refunded += 1;
          result.refundedMinor += o.outstandingMinor;
        } else if (outcome === "exhausted") result.failed += 1;
      } catch {
        result.failed += 1; // recorded and alerted; bounded by MAX_REFUND_ATTEMPTS
      }
      continue;
    }
    if (config.enabled && (o.paymentMethod === "boleto" || o.disputed)) {
      await settleLateRefund(d, o.orderId, undefined, { source: "cron" }); // moves no money: registers and alerts once
      result.left += 1;
      continue;
    }
    result.left += 1;
    const current = await d.order(o.orderId);
    if (alerts >= MAX_ALERTS || !current || current.owedAlerted) continue;
    alerts += 1;
    await d.addEvent(o.orderId, "refund_owed", { amount: o.outstandingMinor });
    const amount = formatMoney(o.outstandingMinor, "BRL", "pt-BR");
    await d.notify("ownerAlert", o.orderId, { alert: o.paymentMethod === "boleto" ? `Pedido cancelado com ${amount} a devolver por Pix ou transferência.` : `Pedido cancelado com ${amount} ainda não devolvidos ao cliente. Nenhum reembolso automático foi feito: confira e use “Reembolsar” no pedido.` });
  }
  return result;
}
