import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/security/cron";

/** Daily (Vercel Cron): cancel unpaid orders past their payment window and their Stripe PaymentIntents. */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { createServiceSupabase } = await import("@/lib/supabase/service");
  const { isStripeConfigured, getStripe } = await import("@/lib/stripe/server");
  const { notifyOrder } = await import("@/lib/orders/notify");
  const { log } = await import("@/lib/log");
  const { data, error } = await createServiceSupabase().rpc("cancel_stale_orders");
  if (error) {
    log.error("cron.orders_failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const rows = data ?? [];
  for (const r of rows) {
    if (r.payment_intent && isStripeConfigured()) await getStripe().paymentIntents.cancel(r.payment_intent).catch(() => undefined);
    await notifyOrder("paymentFailed", r.order_id);
  }
  log.info("cron.orders", { cancelled: rows.length });
  return NextResponse.json({ ok: true, cancelled: rows.length });
}
