import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { EmailKind } from "@/lib/email/templates";
import { formatMoney } from "@/lib/domain/money";
import { log } from "@/lib/log";

type Svc = SupabaseClient<Database>;
type Notify = (kind: EmailKind, orderId: string, extra?: { refundMinor?: number; alert?: string }) => Promise<void>;

export type RefundSource = "webhook" | "cron" | "admin" | "customer";
export type StripeRefund = { id: string; amountMinor: number; status: string };
export type RefundApi = {
  /** Every refund Stripe holds for this payment. */
  list(paymentIntentId: string): Promise<StripeRefund[]>;
  create(p: { paymentIntent: string; amountMinor: number; orderId: string; source: RefundSource }, idempotencyKey: string): Promise<StripeRefund>;
};
type Recorded = { orderId: string; fullyRefunded: boolean; changed: boolean; failedNow: boolean };

/** Automatic attempts on one order. After that it waits, listed in the panel, for the admin to act. */
export const MAX_REFUND_ATTEMPTS = 3;

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
  disputed: boolean;
  blockedAlerted: boolean;
  owedAlerted: boolean;
};

export type RefundClaims = {
  /** A token, or null while another refund of this order is in flight. */
  claim(orderId: string, source: RefundSource): Promise<string | null>;
  release(orderId: string, token: string): Promise<void>;
};

export type LateRefundDeps = RefundClaims & {
  order(orderId: string): Promise<LateOrder | null>;
  stripe: RefundApi;
  record(orderId: string, r: StripeRefund, opts?: { note?: string; actorId?: string }): Promise<Recorded>;
  addEvent(orderId: string, kind: string, data: Record<string, unknown>): Promise<void>;
  notify: Notify;
};

/** Stripe also reports `requires_action` and may add more; for the books they are all "not settled yet". */
export function normalizeRefundStatus(status: string | null | undefined): "pending" | "succeeded" | "failed" | "canceled" {
  return status === "succeeded" || status === "failed" || status === "canceled" ? status : "pending";
}

const dead = (status: string | undefined) => status === "failed" || status === "canceled";
const money = (m: number) => formatMoney(m, "BRL", "pt-BR");
const owed = (o: Pick<LateOrder, "totalMinor" | "refundedMinor" | "pendingMinor">) => o.totalMinor - o.refundedMinor - o.pendingMinor;

/** A 4xx is Stripe's final word that nothing happened (409 only means the same key is still running). */
const definitelyRefused = (e: unknown) => {
  const code = (e as { statusCode?: unknown } | null)?.statusCode;
  return typeof code === "number" && code >= 400 && code < 500 && code !== 409;
};

/** Sync with Stripe: adopts refunds we never heard back about and records the ones that died. */
async function reconcile(d: LateRefundDeps, orderId: string, paymentIntent: string) {
  for (const r of await d.stripe.list(paymentIntent)) {
    const recorded = await d.record(orderId, r);
    if (recorded.failedNow) await d.addEvent(orderId, "refund_failed", { stripeRefundId: r.id, amount: r.amountMinor, status: r.status });
  }
}

/** Read-only for money: brings one order's refunds up to date. False while another refund is in flight. */
export async function reconcileRefunds(d: LateRefundDeps, orderId: string, paymentIntent: string): Promise<boolean> {
  const token = await d.claim(orderId, "cron");
  if (!token) return false;
  try {
    await reconcile(d, orderId, paymentIntent);
    return true;
  } finally {
    await d.release(orderId, token);
  }
}

export type IssueResult =
  | { outcome: "busy" }
  | { outcome: "nothing_owed" }
  | { outcome: "exhausted" }
  | { outcome: "exceeds"; availableMinor: number }
  | { outcome: "created"; refund: StripeRefund; amountMinor: number; confirmed: boolean };

/**
 * The only way a Stripe refund is created, for every source. Inside the claim: sync with Stripe, read
 * the balance, refund at most that, record it. So two sources can never both spend the same balance,
 * and a partial refund made outside Stripe counts. When Stripe's answer is unknown the claim is kept
 * until it expires: the refund may yet land, and the next attempt has to be able to see it.
 */
export async function issueStripeRefund(
  d: LateRefundDeps,
  r: { orderId: string; paymentIntent: string; source: RefundSource; amountMinor?: number; note?: string; actorId?: string; maxAttempts?: number },
): Promise<IssueResult> {
  const token = await d.claim(r.orderId, r.source);
  if (!token) return { outcome: "busy" };
  let keepClaim = false;
  try {
    await reconcile(d, r.orderId, r.paymentIntent);
    const o = await d.order(r.orderId);
    const available = o ? Math.max(0, owed(o)) : 0;
    if (!o || available <= 0) return { outcome: "nothing_owed" };
    // checked here too: the sync above may have just found another dead refund
    if (r.maxAttempts !== undefined && o.failedAttempts >= r.maxAttempts) return { outcome: "exhausted" };
    const amountMinor = r.amountMinor ?? available;
    if (amountMinor > available) return { outcome: "exceeds", availableMinor: available };
    keepClaim = true;
    let refund: StripeRefund;
    try {
      refund = await d.stripe.create({ paymentIntent: r.paymentIntent, amountMinor, orderId: r.orderId, source: r.source }, `refund-${r.orderId}-${o.refundedMinor}-${o.pendingMinor}-${amountMinor}-${o.failedAttempts}`);
    } catch (e) {
      keepClaim = !definitelyRefused(e);
      throw e;
    }
    const recorded = await d.record(r.orderId, refund, { note: r.note, actorId: r.actorId });
    keepClaim = false;
    return { outcome: "created", refund, amountMinor, confirmed: recorded.changed && refund.status === "succeeded" };
  } finally {
    if (!keepClaim) await d.release(r.orderId, token);
  }
}

export type SettleOutcome = "none" | "refunded" | "pending" | "manual" | "blocked" | "exhausted" | "busy" | "over_limit";

/**
 * Give back a payment that landed on a cancelled order. Decided from the state of the money, never
 * from "first delivery", so it can run any number of times and still refunds exactly once. Throws
 * when Stripe fails and attempts remain, after recording it, so the caller's retry runs.
 *
 * Attempts are bounded and the owner is told once. An open dispute stops it: Stripe already took the
 * money back or may yet. The customer hears about a refund only when it is confirmed.
 */
export async function settleLateRefund(d: LateRefundDeps, orderId: string, paymentIntent?: string, opts: { source?: RefundSource; limitMinor?: number } = {}): Promise<SettleOutcome> {
  const o = await d.order(orderId);
  if (!o || o.status !== "cancelled" || !o.paidAt) return "none";
  const due = owed(o);
  const pi = paymentIntent ?? o.paymentIntent;
  if (due <= 0 && !(pi && o.pendingMinor > 0)) return "none";

  if (o.disputed) {
    if (!o.blockedAlerted) {
      await d.addEvent(orderId, "refund_blocked", { reason: "dispute", amount: due });
      await d.notify("ownerAlert", orderId, { alert: `O pedido tem ${money(due)} a devolver, mas há contestação no Stripe, então nada foi reembolsado automaticamente. Resolva a contestação antes de devolver o valor.` });
    }
    return "blocked";
  }

  if (o.paymentMethod === "boleto") {
    if (o.manualPending) return "manual";
    await d.addEvent(orderId, "manual_refund_pending", { amount: due, reason: "paid_after_cancel" });
    await d.notify("ownerManualRefund", orderId, { refundMinor: due });
    return "manual";
  }

  if (o.failedAttempts >= MAX_REFUND_ATTEMPTS) return "exhausted";
  if (opts.limitMinor !== undefined && due > opts.limitMinor) return "over_limit";

  try {
    if (!pi) throw new Error("order has no payment intent");
    const r = await issueStripeRefund(d, { orderId, paymentIntent: pi, source: opts.source ?? "webhook", note: "Pago depois do cancelamento", maxAttempts: MAX_REFUND_ATTEMPTS });
    if (r.outcome === "busy" || r.outcome === "exhausted") return r.outcome;
    if (r.outcome !== "created") return "pending";
    if (r.confirmed) await d.notify("orderRefunded", orderId, { refundMinor: r.amountMinor });
    return "refunded";
  } catch (e) {
    log.error("orders.late_refund_failed", e, { orderId, attempt: o.failedAttempts });
    await d.addEvent(orderId, "refund_failed", { amount: due, attempt: o.failedAttempts, reason: "paid_after_cancel" });
    if (o.failedAttempts === 0) {
      await d.notify("ownerAlert", orderId, { alert: `O pedido foi pago depois de cancelado e o reembolso automático de ${money(due)} falhou. Use “Reembolsar” no pedido para devolver o valor.` });
    }
    if (o.failedAttempts + 1 >= MAX_REFUND_ATTEMPTS) return "exhausted";
    throw e;
  }
}

/** The claim works whether or not migration 0031 is live: until then refunds run as they always did. */
export function refundClaims(svc: Svc): RefundClaims {
  const UNGUARDED = "unguarded";
  return {
    async claim(orderId, source) {
      const { data, error } = await svc.rpc("order_refund_claim", { p_order: orderId, p_source: source });
      if (error?.code === "PGRST202") {
        log.error("orders.refund_claim_missing", new Error("migration 0031 not applied"), { orderId });
        return UNGUARDED;
      }
      if (error) throw new Error(error.message);
      return data;
    },
    async release(orderId, token) {
      if (token === UNGUARDED) return;
      const { error } = await svc.rpc("order_refund_release", { p_order: orderId, p_token: token });
      if (error) log.error("orders.refund_release_failed", error, { orderId });
    },
  };
}

/** Writes one Stripe refund to the books. `failedNow`: it just died, so the money did not reach the customer. */
export async function recordStripeRefund(svc: Svc, target: { orderId?: string; paymentIntentId?: string }, r: StripeRefund, opts: { note?: string; actorId?: string } = {}): Promise<Recorded | null> {
  const status = normalizeRefundStatus(r.status);
  const { data: before } = await svc.from("order_refunds").select("status").eq("stripe_refund_id", r.id).maybeSingle();
  const { data, error } = await svc.rpc("order_record_refund", { p_order: (target.orderId ?? null) as never, p_pi: (target.paymentIntentId ?? null) as never, p_amount: r.amountMinor, p_method: "stripe", p_stripe_refund: r.id, p_status: status, p_note: (opts.note ?? null) as never, p_actor: (opts.actorId ?? null) as never });
  if (error) throw new Error(error.message);
  const x = data?.[0];
  return x ? { orderId: x.order_id, fullyRefunded: x.fully_refunded, changed: x.changed, failedNow: dead(status) && !dead(before?.status) } : null;
}

export function lateRefundDeps(svc: Svc, stripe: RefundApi, notify: Notify): LateRefundDeps {
  return {
    ...refundClaims(svc),
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
      const has = (kind: string) => data.order_events.some((e) => e.kind === kind);
      return {
        status: data.status,
        paymentMethod: data.payment_method,
        paidAt: data.paid_at,
        totalMinor: Number(data.total_minor),
        refundedMinor: Number(data.refunded_minor),
        paymentIntent: data.stripe_payment_intent_id,
        pendingMinor: data.order_refunds.filter((r) => r.status === "pending").reduce((sum, r) => sum + Number(r.amount_minor), 0),
        failedAttempts: data.order_events.filter((e) => e.kind === "refund_failed").length,
        manualPending: has("manual_refund_pending"),
        disputed: has("dispute_created"),
        blockedAlerted: has("refund_blocked"),
        owedAlerted: has("refund_owed"),
      };
    },
    async record(orderId, r, opts) {
      const recorded = await recordStripeRefund(svc, { orderId }, r, opts);
      if (!recorded) throw new Error("order not found");
      return recorded;
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
    async create({ paymentIntent, amountMinor, orderId, source }, key) {
      const r = await stripe.refunds.create({ payment_intent: paymentIntent, amount: amountMinor, metadata: { order_id: orderId, source } }, { idempotencyKey: key });
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

export type UnsettledRefund = { orderId: string; number: number; paymentMethod: string; outstandingMinor: number; disputed: boolean; attempts: number };

/** Cancelled orders still holding the customer's money. The state itself is the alert: it needs no e-mail and clears when paid back. */
export async function listUnsettledRefunds(svc: Svc, limit = 1000): Promise<UnsettledRefund[]> {
  const { data, error } = await svc
    .from("orders")
    .select("id, number, payment_method, total_minor, refunded_minor, order_refunds(amount_minor, status), order_events(kind)")
    .eq("status", "cancelled")
    .not("paid_at", "is", null)
    .order("cancelled_at")
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((o) => {
    const pending = o.order_refunds.filter((r) => r.status === "pending").reduce((sum, r) => sum + Number(r.amount_minor), 0);
    const outstandingMinor = Number(o.total_minor) - Number(o.refunded_minor) - pending;
    if (outstandingMinor <= 0) return [];
    return [{ orderId: o.id, number: Number(o.number), paymentMethod: o.payment_method, outstandingMinor, disputed: o.order_events.some((e) => e.kind === "dispute_created"), attempts: o.order_events.filter((e) => e.kind === "refund_failed").length }];
  });
}

/** Refunds Stripe should have settled by now: if the webhook was lost, only asking reveals the outcome. */
export async function listStalePendingRefunds(svc: Svc, olderThanMinutes = 60, limit = 50) {
  const { data, error } = await svc
    .from("order_refunds")
    .select("order_id, orders!inner(stripe_payment_intent_id)")
    .eq("status", "pending")
    .eq("method", "stripe")
    .lt("created_at", new Date(Date.now() - olderThanMinutes * 60_000).toISOString())
    .limit(limit);
  if (error) throw new Error(error.message);
  const seen = new Map<string, string>();
  for (const r of data ?? []) if (r.orders.stripe_payment_intent_id) seen.set(r.order_id, r.orders.stripe_payment_intent_id);
  return [...seen].map(([orderId, paymentIntent]) => ({ orderId, paymentIntent }));
}
