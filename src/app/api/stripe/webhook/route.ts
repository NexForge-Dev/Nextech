import { after, NextResponse, type NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe/server";
import { verifyStripeEvent } from "@/lib/stripe/verify";
import { handleStripeEvent, type WebhookDeps } from "@/lib/orders/webhook";
import { confirmPayment, lateRefundDeps, recordStripeRefund, settleLateRefund, stripeRefundApi } from "@/lib/orders/late-refund";
import { notifyOrder } from "@/lib/orders/notify";
import { log } from "@/lib/log";
import { analytics } from "@/lib/analytics";
import { panelItems } from "@/lib/domain/sales-bi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * NexForge panel metrics for a paid / failed order (account id + total only; no order data).
 * Both carry a fixed event id (order id / Stripe event id), so a webhook retry never counts twice.
 */
async function trackOrder(svc: ReturnType<typeof createServiceSupabase>, kind: "paid" | "failed", orderId: string, stripeEventId: string) {
  try {
    const { data: o } = await svc.from("orders").select("user_id, subtotal_minor, total_minor").eq("id", orderId).maybeSingle();
    if (!o?.user_id) return;
    if (kind === "paid") {
      analytics.orderPaid(o.user_id, orderId, Number(o.total_minor));
      await trackItems(svc, o.user_id, orderId, Number(o.subtotal_minor), Number(o.total_minor));
    } else analytics.paymentFailed(o.user_id, stripeEventId);
  } catch (e) {
    log.info("nexforge.order_lookup_failed", { reason: e instanceof Error ? e.message.slice(0, 80) : "unknown" });
  }
}

/** What was sold, for the panel's best-seller rankings. Slugs and amounts only. */
async function trackItems(svc: ReturnType<typeof createServiceSupabase>, userId: string, orderId: string, subtotalMinor: number, totalMinor: number) {
  const { data: rows } = await svc.from("order_items").select("id, slug, quantity, line_total_minor, products(brands(slug), categories(slug))").eq("order_id", orderId);
  const items = (rows ?? []).map((i) => ({
    id: i.id,
    slug: i.slug,
    quantity: i.quantity,
    lineTotalMinor: Number(i.line_total_minor),
    category: i.products?.categories?.slug ?? null,
    brand: i.products?.brands?.slug ?? null,
  }));
  analytics.orderItems(userId, orderId, panelItems({ subtotalMinor, totalMinor }, items));
}

async function trackRefund(svc: ReturnType<typeof createServiceSupabase>, orderId: string, stripeRefundId: string, amountMinor: number) {
  try {
    const { data: o } = await svc.from("orders").select("user_id, total_minor").eq("id", orderId).maybeSingle();
    if (o) analytics.refund(o.user_id, orderId, stripeRefundId, { amountMinor, full: amountMinor >= Number(o.total_minor), method: "stripe" });
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
    markPaid: (piId, orderId, fee, summary) => confirmPayment(svc, piId, orderId, fee, summary),
    async paidAfterCancel(piId, orderId) {
      const outcome = await settleLateRefund(lateRefundDeps(svc, stripeRefundApi(getStripe()), notifyOrder), orderId, piId);
      if (outcome === "busy") throw new Error("refund in flight: retry later");
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
      const x = await recordStripeRefund(svc, { paymentIntentId: r.paymentIntentId }, { id: r.stripeRefundId, amountMinor: r.amountMinor, status: r.status });
      // Every Stripe refund passes here, including ones started in the admin or by the customer.
      if (x && r.status === "succeeded") await trackRefund(svc, x.orderId, r.stripeRefundId, r.amountMinor);
      return x;
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
  // not a bad signature but a broken deployment: say so, or every payment goes unconfirmed in silence
  if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    log.error("stripe.webhook_secret_missing", new Error("STRIPE_WEBHOOK_SECRET is not set"));
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }
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
