import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/security/cron";

/** Daily (Vercel Cron): cancel unpaid orders past their payment window, then finish refunds still owed on cancelled orders. */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { createServiceSupabase } = await import("@/lib/supabase/service");
  const { expireStaleOrders } = await import("@/lib/orders/expire");
  const { settleOwedRefunds } = await import("@/lib/orders/owed-refunds");
  const { log } = await import("@/lib/log");
  const svc = createServiceSupabase();
  try {
    const result = await expireStaleOrders(svc);
    const refunds = await settleOwedRefunds(svc);
    log.info("cron.orders", { ...result, refunds });
    return NextResponse.json({ ok: true, ...result, refunds });
  } catch (e) {
    log.error("cron.orders_failed", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
