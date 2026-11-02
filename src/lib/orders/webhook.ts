import type { EmailKind } from "@/lib/email/templates";

/** Minimal shape of the Stripe events we handle (kept structural so tests need no Stripe SDK). */
export type StripeEventLike = { id: string; type: string; data: { object: Record<string, unknown> } };

export type WebhookDeps = {
  /** Insert into stripe_events; false when this event id was already handled. */
  claimEvent(id: string, type: string): Promise<boolean>;
  releaseEvent(id: string): Promise<void>;
  markProcessed(id: string): Promise<void>;
  /** Real Stripe fee (balance transaction) and a customer-safe summary such as "Cartão final 4242". */
  paymentDetails(paymentIntent: Record<string, unknown>): Promise<{ feeMinor: number | null; summary: string | null }>;
  /** awaiting_payment → awaiting_supplier (via paid). transitioned=false when already paid/cancelled. */
  markPaid(paymentIntentId: string, orderId: string, feeMinor: number | null, summary: string | null): Promise<{ orderId: string; transitioned: boolean } | null>;
  cancelByPaymentIntent(paymentIntentId: string): Promise<{ orderId: string } | null>;
  recordRefund(r: { paymentIntentId: string; stripeRefundId: string; amountMinor: number; status: string }): Promise<{ orderId: string; fullyRefunded: boolean; changed: boolean } | null>;
  /** Append to the order history; null when no order uses this payment intent. */
  addEvent(paymentIntentId: string, kind: string, data: Record<string, unknown>): Promise<{ orderId: string } | null>;
  notify(kind: EmailKind, orderId: string, extra?: { refundMinor?: number }): Promise<void>;
};

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

const str = (v: unknown) => (typeof v === "string" ? v : null);
const piIdOf = (o: Record<string, unknown>) => (o.object === "payment_intent" ? str(o.id) : str(o.payment_intent));

/**
 * Apply a verified Stripe event to the order it belongs to. Safe to receive the same event many
 * times, under different ids, and out of order: every write is a guarded state transition.
 */
export async function handleStripeEvent(event: StripeEventLike, d: WebhookDeps): Promise<WebhookOutcome> {
  if (!(await d.claimEvent(event.id, event.type))) return "duplicate";
  try {
    const outcome = await apply(event, d);
    await d.markProcessed(event.id);
    return outcome;
  } catch (e) {
    await d.releaseEvent(event.id);
    throw e;
  }
}

async function apply(event: StripeEventLike, d: WebhookDeps): Promise<WebhookOutcome> {
  const o = event.data.object;
  const piId = piIdOf(o);
  if (!piId) return "ignored";

  switch (event.type) {
    case "payment_intent.succeeded": {
      const orderId = str((o.metadata as Record<string, unknown> | undefined)?.order_id);
      if (!orderId) return "ignored";
      const { feeMinor, summary } = await d.paymentDetails(o);
      const r = await d.markPaid(piId, orderId, feeMinor, summary);
      if (!r) return "ignored";
      if (r.transitioned) {
        await d.notify("orderConfirmed", r.orderId);
        await d.notify("ownerNewOrder", r.orderId);
      }
      return "processed";
    }
    case "payment_intent.payment_failed": {
      const err = o.last_payment_error as Record<string, unknown> | undefined;
      const r = await d.addEvent(piId, "payment_failed", { reason: str(err?.message), code: str(err?.code) });
      if (!r) return "ignored";
      // card failures can be retried in the same checkout; async methods (Pix expiry) are final
      if (o.status === "canceled") await d.cancelByPaymentIntent(piId);
      return "processed";
    }
    case "payment_intent.canceled": {
      const r = await d.cancelByPaymentIntent(piId);
      if (r) await d.notify("paymentFailed", r.orderId);
      return r ? "processed" : "ignored";
    }
    case "charge.refunded":
    case "charge.refund.updated":
    case "refund.updated":
    case "refund.created": {
      const refunds =
        o.object === "refund"
          ? [o]
          : (((o.refunds as Record<string, unknown> | undefined)?.data as Record<string, unknown>[] | undefined) ?? []);
      let last: { orderId: string; fullyRefunded: boolean; changed: boolean } | null = null;
      let changedAny = false;
      for (const rf of refunds) {
        const id = str(rf.id);
        if (!id) continue;
        last = (await d.recordRefund({ paymentIntentId: piId, stripeRefundId: id, amountMinor: Number(rf.amount ?? 0), status: str(rf.status) ?? "pending" })) ?? last;
        changedAny ||= !!last?.changed;
      }
      if (!last) return "ignored";
      if (changedAny) await d.notify("orderRefunded", last.orderId, { refundMinor: Number(o.amount_refunded ?? o.amount ?? 0) || undefined });
      return "processed";
    }
    case "charge.dispute.created":
    case "charge.dispute.closed": {
      const r = await d.addEvent(piId, event.type === "charge.dispute.created" ? "dispute_created" : "dispute_closed", { amount: o.amount ?? null, status: o.status ?? null });
      if (!r) return "ignored";
      if (event.type === "charge.dispute.created") await d.notify("ownerDispute", r.orderId);
      return "processed";
    }
    default:
      return "ignored";
  }
}
