import "server-only";
import type { createServiceSupabase } from "@/lib/supabase/service";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { notifyOrder } from "@/lib/orders/notify";
import { cancelStaleOrdersWith } from "@/lib/orders/stale";

/** Cancel unpaid orders past their payment window, asking Stripe first. Returns their stock. */
export function expireStaleOrders(svc: ReturnType<typeof createServiceSupabase>) {
  return cancelStaleOrdersWith({
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
    async paymentStuck(o) {
      const { data } = await svc.from("order_events").select("id").eq("order_id", o.orderId).eq("kind", "payment_stuck").limit(1);
      if (data?.length) return;
      await svc.from("order_events").insert({ order_id: o.orderId, actor: "system", kind: "payment_stuck", data: { paymentIntent: o.paymentIntent } });
      await notifyOrder("ownerAlert", o.orderId, { alert: `O Stripe recebeu o pagamento ${o.paymentIntent}, mas o pedido segue sem confirmação: o webhook não chegou. Confira o webhook no Stripe e reenvie o evento.` });
    },
  });
}
