import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { EmailKind } from "@/lib/email/templates";
import { formatMoney } from "@/lib/domain/money";
import { log } from "@/lib/log";

type Svc = SupabaseClient<Database>;
type Notify = (kind: EmailKind, orderId: string, extra?: { refundMinor?: number; alert?: string }) => Promise<void>;

export type StripeRefund = { id: string; amountMinor: number; status: string };
export type RefundApi = {
  /** Every refund Stripe holds for this payment. */
  list(paymentIntentId: string): Promise<StripeRefund[]>;
  create(p: { paymentIntent: string; amountMinor: number; orderId: string }, idempotencyKey: string): Promise<StripeRefund>;
};

type LateOrder = {
  status: string;
  paymentMethod: string;
  paidAt: string | null;
  totalMinor: number;
  refundedMinor: number;
  paymentIntent: string | null;
  /** Refunds Stripe is still processing: they will cover this amount, so nothing new is due for it. */
  pendingMinor: number;
  failedAttempts: number;
  manualPending: boolean;
};

export type LateRefundDeps = {
  order(orderId: string): Promise<LateOrder | null>;
  stripe: RefundApi;
  record(orderId: string, r: StripeRefund): Promise<void>;
  addEvent(orderId: string, kind: string, data: Record<string, unknown>): Promise<void>;
  notify: Notify;
};

/** Stripe also reports `requires_action` and may add more; for the books they are all "not settled yet". */
export function normalizeRefundStatus(status: string | null | undefined): "pending" | "succeeded" | "failed" | "canceled" {
  return status === "succeeded" || status === "failed" || status === "canceled" ? status : "pending";
}

const dead = (status: string) => status === "failed" || status === "canceled";
const money = (m: number) => formatMoney(m, "BRL", "pt-BR");
const owed = (o: Pick<LateOrder, "totalMinor" | "refundedMinor" | "pendingMinor">) => o.totalMinor - o.refundedMinor - o.pendingMinor;

/**
 * Give back a payment that landed on a cancelled order. Decided from the state of the money, never
 * from "first delivery", so it can run any number of times (Stripe retry, daily sweep) and still
 * refunds exactly once. Throws when Stripe fails, after recording it, so the caller's retry runs.
 *
 * Stripe stores the outcome of a request under its idempotency key, failures included: retrying the
 * same key would replay the failure. So each attempt has its own key, and Stripe is asked first
 * what already exists. A double refund is impossible anyway: Stripe refuses to exceed the charge.
 */
export async function settleLateRefund(d: LateRefundDeps, orderId: string, paymentIntent?: string, opts: { alertEveryFailure?: boolean } = {}): Promise<"none" | "refunded" | "pending" | "manual"> {
  let o = await d.order(orderId);
  if (!o || o.status !== "cancelled" || !o.paidAt || owed(o) <= 0) return "none";

  if (o.paymentMethod === "boleto") {
    if (o.manualPending) return "manual";
    const amount = owed(o);
    await d.addEvent(orderId, "manual_refund_pending", { amount, reason: "paid_after_cancel" });
    await d.notify("ownerManualRefund", orderId, { refundMinor: amount });
    return "manual";
  }

  const pi = paymentIntent ?? o.paymentIntent;
  try {
    if (!pi) throw new Error("order has no payment intent");
    for (const r of await d.stripe.list(pi)) if (!dead(r.status)) await d.record(orderId, r);
    o = (await d.order(orderId)) ?? o;
    const amount = owed(o);
    if (amount <= 0) return "pending";
    const refund = await d.stripe.create({ paymentIntent: pi, amountMinor: amount, orderId }, `refund-after-cancel-${orderId}-${amount}-${o.failedAttempts}`);
    await d.record(orderId, refund);
    await d.notify("orderRefunded", orderId, { refundMinor: amount });
    return "refunded";
  } catch (e) {
    const amount = owed(o);
    log.error("orders.late_refund_failed", e, { orderId, attempt: o.failedAttempts });
    await d.addEvent(orderId, "refund_failed", { amount, attempt: o.failedAttempts, reason: "paid_after_cancel" });
    if (opts.alertEveryFailure || o.failedAttempts === 0) {
      await d.notify("ownerAlert", orderId, { alert: `O pedido foi pago depois de cancelado e o reembolso automático de ${money(amount)} falhou. Novas tentativas são feitas sozinhas; se preferir, use “Reembolsar” no painel.` });
    }
    throw e;
  }
}

export function lateRefundDeps(svc: Svc, stripe: RefundApi, notify: Notify): LateRefundDeps {
  return {
    stripe,
    notify,
    async order(orderId) {
      const { data, error } = await svc
        .from("orders")
        .select("status, payment_method, paid_at, total_minor, refunded_minor, stripe_payment_intent_id, order_refunds(amount_minor, status), order_events(kind)")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        status: data.status,
        paymentMethod: data.payment_method,
        paidAt: data.paid_at,
        totalMinor: Number(data.total_minor),
        refundedMinor: Number(data.refunded_minor),
        paymentIntent: data.stripe_payment_intent_id,
        pendingMinor: data.order_refunds.filter((r) => r.status === "pending").reduce((sum, r) => sum + Number(r.amount_minor), 0),
        failedAttempts: data.order_events.filter((e) => e.kind === "refund_failed").length,
        manualPending: data.order_events.some((e) => e.kind === "manual_refund_pending"),
      };
    },
    async record(orderId, r) {
      const { error } = await svc.rpc("order_record_refund", { p_order: orderId, p_pi: null as never, p_amount: r.amountMinor, p_method: "stripe", p_stripe_refund: r.id, p_status: normalizeRefundStatus(r.status), p_note: "Pago depois do cancelamento" as never, p_actor: null as never });
      if (error) throw new Error(error.message);
    },
    async addEvent(orderId, kind, data) {
      const { error } = await svc.from("order_events").insert({ order_id: orderId, actor: "system", kind, data: data as never });
      if (error) throw new Error(error.message);
    },
  };
}

/** The Stripe calls behind RefundApi. */
export function stripeRefundApi(stripe: {
  refunds: {
    list(p: { payment_intent: string; limit: number }): PromiseLike<{ data: { id: string; amount: number; status: string | null }[] }>;
    create(p: { payment_intent: string; amount: number; metadata: Record<string, string> }, o: { idempotencyKey: string }): PromiseLike<{ id: string; amount: number; status: string | null }>;
  };
}): RefundApi {
  return {
    async list(pi) {
      return (await stripe.refunds.list({ payment_intent: pi, limit: 100 })).data.map((r) => ({ id: r.id, amountMinor: r.amount, status: r.status ?? "pending" }));
    },
    async create({ paymentIntent, amountMinor, orderId }, key) {
      const r = await stripe.refunds.create({ payment_intent: paymentIntent, amount: amountMinor, metadata: { order_id: orderId, source: "paid_after_cancel" } }, { idempotencyKey: key });
      return { id: r.id, amountMinor: r.amount, status: r.status ?? "pending" };
    },
  };
}

/**
 * order_mark_paid plus the one fact the retry needs: is this order cancelled right now? The RPC's own
 * was_cancelled is true only on the first delivery, so it cannot drive a retry.
 */
export async function confirmPayment(svc: Svc, paymentIntent: string, orderId: string, feeMinor: number | null, summary: string | null) {
  const { data, error } = await svc.rpc("order_mark_paid", { p_pi: paymentIntent, p_order: orderId, p_fee: feeMinor as never, p_summary: summary as never });
  if (error) throw new Error(error.message);
  const r = data?.[0];
  if (!r) return null;
  if (r.transitioned) return { orderId: r.order_id, transitioned: true, wasCancelled: false };
  const { data: o, error: readError } = await svc.from("orders").select("status").eq("id", r.order_id).single();
  if (readError) throw new Error(readError.message);
  return { orderId: r.order_id, transitioned: false, wasCancelled: o.status === "cancelled" };
}

export type UnsettledRefund = { orderId: string; number: number; paymentMethod: string; outstandingMinor: number };

/** Cancelled orders still holding the customer's money. The state itself is the alert: it needs no e-mail and clears when paid back. */
export async function listUnsettledRefunds(svc: Svc, limit = 100): Promise<UnsettledRefund[]> {
  const { data, error } = await svc
    .from("orders")
    .select("id, number, payment_method, total_minor, refunded_minor, order_refunds(amount_minor, status)")
    .eq("status", "cancelled")
    .not("paid_at", "is", null)
    .order("cancelled_at")
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((o) => {
    const pending = o.order_refunds.filter((r) => r.status === "pending").reduce((sum, r) => sum + Number(r.amount_minor), 0);
    const outstandingMinor = Number(o.total_minor) - Number(o.refunded_minor) - pending;
    return outstandingMinor > 0 ? [{ orderId: o.id, number: Number(o.number), paymentMethod: o.payment_method, outstandingMinor }] : [];
  });
}
