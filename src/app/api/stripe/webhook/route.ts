import { after, NextResponse, type NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe/server";
import { verifyStripeEvent } from "@/lib/stripe/verify";
import { handleStripeEvent, type WebhookDeps } from "@/lib/orders/webhook";
import { notifyOrder } from "@/lib/orders/notify";
import { log } from "@/lib/log";
import { analytics } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * NexForge panel metrics for a paid / failed order (account id + total only; no order data).
 * Both carry a fixed event id (order id / Stripe event id), so a webhook retry never counts twice.
 */
async function trackOrder(svc: ReturnType<typeof createServiceSupabase>, kind: "paid" | "failed", orderId: string, stripeEventId: string) {
  try {
    const { data: o } = await svc.from("orders").select("user_id, total_minor").eq("id", orderId).maybeSingle();
    if (!o?.user_id) return;
    if (kind === "paid") analytics.orderPaid(o.user_id, orderId, Number(o.total_minor));
    else analytics.paymentFailed(o.user_id, stripeEventId);
  } catch (e) {
    log.info("nexforge.order_lookup_failed", { reason: e instanceof Error ? e.message.slice(0, 80) : "unknown" });
  }
}

function deps(stripeEventId: string): WebhookDeps {
  const svc = createServiceSupabase();
  return {
    async claimEvent(id, type) {
      // skips only events already processed; a claim stuck for 2 minutes (crash/timeout) is retried
      const { data, error } = await svc.rpc("claim_stripe_event", { p_id: id, p_type: type });
      if (error) throw new Error(error.message);
      return data === true;
    },
    async releaseEvent(id) {
      await svc.from("stripe_events").delete().eq("id", id);
    },
    async markProcessed(id) {
      await svc.from("stripe_events").update({ processed_at: new Date().toISOString() }).eq("id", id);
    },
    async paymentDetails(pi) {
      const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : null;
      if (!chargeId) return { feeMinor: null, summary: null };
      try {
        const ch = await getStripe().charges.retrieve(chargeId, { expand: ["balance_transaction"] });
        const bt = ch.balance_transaction;
        const fee = bt && typeof bt === "object" ? bt.fee : null;
        const d = ch.payment_method_details;
        const summary = d?.card ? `Cartão ${d.card.brand ?? ""} final ${d.card.last4 ?? ""}`.replace(/\s+/g, " ").trim() : d?.boleto ? "Boleto" : d?.pix ? "Pix" : null;
        return { feeMinor: fee, summary };
      } catch (e) {
        log.error("stripe.fee_lookup_failed", e);
        return { feeMinor: null, summary: null };
      }
    },
    async orderAmount(orderId) {
      const { data, error } = await svc.from("orders").select("total_minor, currency").eq("id", orderId).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { totalMinor: Number(data.total_minor), currency: data.currency } : null;
    },
    async markPaid(piId, orderId, fee, summary) {
      const { data, error } = await svc.rpc("order_mark_paid", { p_pi: piId, p_order: orderId, p_fee: fee as never, p_summary: summary as never });
      if (error) throw new Error(error.message);
      const r = data?.[0];
      return r ? { orderId: r.order_id, transitioned: r.transitioned, wasCancelled: r.was_cancelled } : null;
    },
    async paidAfterCancel(piId, orderId) {
      const { data: o } = await svc.from("orders").select("payment_method, total_minor, refunded_minor").eq("id", orderId).single();
      const amount = Number(o?.total_minor ?? 0) - Number(o?.refunded_minor ?? 0);
      if (!o || amount <= 0) return;
      if (o.payment_method === "boleto") {
        await svc.from("order_events").insert({ order_id: orderId, actor: "system", kind: "manual_refund_pending", data: { amount, reason: "paid_after_cancel" } });
        after(() => notifyOrder("ownerManualRefund", orderId, { refundMinor: amount }));
        return;
      }
      const refund = await getStripe().refunds.create({ payment_intent: piId, amount, metadata: { order_id: orderId, source: "paid_after_cancel" } }, { idempotencyKey: `refund-after-cancel-${orderId}` });
      await svc.rpc("order_record_refund", { p_order: orderId, p_pi: null as never, p_amount: amount, p_method: "stripe", p_stripe_refund: refund.id, p_status: refund.status === "succeeded" ? "succeeded" : "pending", p_note: "Pago depois do cancelamento" as never, p_actor: null as never });
      after(() => notifyOrder("orderRefunded", orderId, { refundMinor: amount }));
    },
    async listRefunds(chargeId) {
      const list = await getStripe().refunds.list({ charge: chargeId, limit: 100 });
      return list.data as unknown as Record<string, unknown>[];
    },
    async cancelByPaymentIntent(piId) {
      const { data, error } = await svc.rpc("order_cancel_by_pi", { p_pi: piId });
      if (error) throw new Error(error.message);
      return data?.[0] ? { orderId: data[0].order_id } : null;
    },
    async recordRefund(r) {
      const { data, error } = await svc.rpc("order_record_refund", {
        p_order: null as never, p_pi: r.paymentIntentId, p_amount: r.amountMinor, p_method: "stripe", p_stripe_refund: r.stripeRefundId, p_status: r.status, p_note: null as never, p_actor: null as never,
      });
      if (error) throw new Error(error.message);
      const x = data?.[0];
      return x ? { orderId: x.order_id, fullyRefunded: x.fully_refunded, changed: x.changed } : null;
    },
    async addEvent(piId, kind, data) {
      const { data: rows, error } = await svc.rpc("order_add_event_by_pi", { p_pi: piId, p_kind: kind, p_data: data as never });
      if (error) throw new Error(error.message);
      const orderId = rows?.[0]?.order_id;
      if (orderId && kind === "payment_failed") await trackOrder(svc, "failed", orderId, stripeEventId);
      return orderId ? { orderId } : null;
    },
    async notify(kind, orderId, extra) {
      // emails go out after the 2xx so Stripe never waits on the email provider
      after(() => notifyOrder(kind, orderId, extra));
      if (kind === "orderConfirmed") await trackOrder(svc, "paid", orderId, stripeEventId);
    },
  };
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const v = verifyStripeEvent(body, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET);
  if (!v.ok) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  try {
    const outcome = await handleStripeEvent(v.event, deps(v.event.id));
    return NextResponse.json({ received: true, outcome });
  } catch (e) {
    log.error("stripe.webhook_failed", e, { type: v.event.type, id: v.event.id });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
