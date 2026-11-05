import "server-only";
import type { createServiceSupabase } from "@/lib/supabase/service";
import { canTakePayments, getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { notifyOrder } from "@/lib/orders/notify";
import { lateRefundDeps, stripeRefundApi, type RefundApi } from "@/lib/orders/late-refund";
import { sweepConfig, sweepOwedRefunds } from "@/lib/orders/refund-sweep";

/** Off unless AUTO_REFUND_SWEEP says otherwise: see sweepOwedRefunds for what each mode does. */
export function settleOwedRefunds(svc: ReturnType<typeof createServiceSupabase>) {
  const stripeReady = isStripeConfigured();
  const noStripe: RefundApi = { list: async () => [], create: () => Promise.reject(new Error("stripe not configured")) };
  const deps = lateRefundDeps(svc, stripeReady ? stripeRefundApi(getStripe()) : noStripe, notifyOrder);
  return sweepOwedRefunds(svc, deps, sweepConfig(process.env, canTakePayments()), stripeReady);
}
