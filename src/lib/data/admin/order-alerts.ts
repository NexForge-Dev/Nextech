import "server-only";
import { createServiceSupabase } from "@/lib/supabase/service";
import { formatMoney } from "@/lib/domain/money";
import { orderAlertsFrom, type AlertEvent, type OrderAlert } from "@/lib/orders/order-alerts";
import { listUnsettledRefunds } from "@/lib/orders/late-refund";

export type { OrderAlert };

const DAYS = 30;

/** What needs the owner now. Read from the orders themselves, so it works with no e-mail provider. */
export async function getOrderAlerts(): Promise<{ alerts: OrderAlert[]; emailsNotSent: number }> {
  const svc = createServiceSupabase();
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
  const [owed, events, skipped] = await Promise.all([
    listUnsettledRefunds(svc),
    svc.from("order_events").select("order_id, at, data, orders(number, total_minor, refunded_minor)").eq("kind", "owner_alert").gte("at", since).order("at", { ascending: false }).limit(50),
    svc.from("order_events").select("id", { count: "exact", head: true }).eq("kind", "email_skipped").gte("at", since),
  ]);
  const rows: AlertEvent[] = (events.data ?? []).flatMap((e) =>
    e.orders ? [{ orderId: e.order_id, number: Number(e.orders.number), at: e.at, data: (e.data ?? {}) as AlertEvent["data"], settled: Number(e.orders.refunded_minor) >= Number(e.orders.total_minor) }] : [],
  );
  return { alerts: orderAlertsFrom(owed, rows, (m) => formatMoney(m, "BRL", "pt-BR")), emailsNotSent: skipped.count ?? 0 };
}
