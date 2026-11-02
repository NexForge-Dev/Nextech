import { after, NextResponse, type NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe/server";
import { verifyStripeEvent } from "@/lib/stripe/verify";
import { handleStripeEvent, type WebhookDeps } from "@/lib/orders/webhook";
import { notifyOrder } from "@/lib/orders/notify";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deps(): WebhookDeps {
  const svc = createServiceSupabase();
  return {
    async claimEvent(id, type) {
      const { error } = await svc.from("stripe_events").insert({ id, type });
      if (error?.code === "23505") return false;
      if (error) throw new Error(error.message);
      return true;
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
    async markPaid(piId, orderId, fee, summary) {
      const { data, error } = await svc.rpc("order_mark_paid", { p_pi: piId, p_order: orderId, p_fee: fee as never, p_summary: summary as never });
      if (error) throw new Error(error.message);
      const r = data?.[0];
      return r ? { orderId: r.order_id, transitioned: r.transitioned } : null;
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
      return rows?.[0] ? { orderId: rows[0].order_id } : null;
    },
    async notify(kind, orderId, extra) {
      // emails go out after the 2xx so Stripe never waits on the email provider
      after(() => notifyOrder(kind, orderId, extra));
    },
  };
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const v = verifyStripeEvent(body, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET);
  if (!v.ok) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  try {
    const outcome = await handleStripeEvent(v.event, deps());
    return NextResponse.json({ received: true, outcome });
  } catch (e) {
    log.error("stripe.webhook_failed", e, { type: v.event.type, id: v.event.id });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
