import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/security/cron";

/** Daily (Vercel Cron): cancel unpaid orders past their payment window, after checking each payment at Stripe. */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { createServiceSupabase } = await import("@/lib/supabase/service");
  const { isStripeConfigured, getStripe } = await import("@/lib/stripe/server");
  const { notifyOrder } = await import("@/lib/orders/notify");
  const { cancelStaleOrdersWith } = await import("@/lib/orders/stale");
  const { log } = await import("@/lib/log");
  const svc = createServiceSupabase();
  try {
    const result = await cancelStaleOrdersWith({
      async listStale() {
        const { data, error } = await svc.rpc("stale_unpaid_orders");
        if (error) throw new Error(error.message);
        return (data ?? []).map((r) => ({ orderId: r.order_id, paymentIntent: r.payment_intent, paymentMethod: r.payment_method }));
      },
      async paymentStatus(pi) {
        if (!isStripeConfigured()) return null;
        return (await getStripe().paymentIntents.retrieve(pi)).status;
      },
      async cancelPaymentIntent(pi) {
        await getStripe().paymentIntents.cancel(pi);
      },
      async cancelInDb(orderId) {
        const { data, error } = await svc.rpc("order_cancel_unpaid", { p_order: orderId });
        if (error) throw new Error(error.message);
        return data === true;
      },
      notify: (kind, orderId) => notifyOrder(kind, orderId),
    });
    log.info("cron.orders", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    log.error("cron.orders_failed", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
