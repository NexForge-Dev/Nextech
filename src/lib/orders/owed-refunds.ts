import "server-only";
import type { createServiceSupabase } from "@/lib/supabase/service";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { notifyOrder } from "@/lib/orders/notify";
import { lateRefundDeps, listUnsettledRefunds, settleLateRefund, stripeRefundApi, type RefundApi } from "@/lib/orders/late-refund";
import { log } from "@/lib/log";

/**
 * Stripe stops retrying a webhook after about three days, and a customer or admin cancellation has
 * no retry at all: this daily pass refunds whatever cancelled orders still owe. Failures stay listed.
 */
export async function settleOwedRefunds(svc: ReturnType<typeof createServiceSupabase>) {
  const owed = await listUnsettledRefunds(svc);
  const stripeReady = isStripeConfigured();
  // a boleto is refunded by hand and never reaches Stripe
  const noStripe: RefundApi = { list: async () => [], create: () => Promise.reject(new Error("stripe not configured")) };
  const deps = lateRefundDeps(svc, stripeReady ? stripeRefundApi(getStripe()) : noStripe, notifyOrder);
  let settled = 0;
  let failed = 0;
  for (const o of owed) {
    if (!stripeReady && o.paymentMethod !== "boleto") {
      failed += 1;
      continue;
    }
    try {
      if ((await settleLateRefund(deps, o.orderId, undefined, { alertEveryFailure: true })) !== "none") settled += 1;
    } catch (e) {
      failed += 1; // already recorded and alerted; the next run tries again
      log.info("cron.refund_retry_failed", { orderId: o.orderId, reason: e instanceof Error ? e.message.slice(0, 80) : "unknown" });
    }
  }
  return { owed: owed.length, settled, failed };
}
