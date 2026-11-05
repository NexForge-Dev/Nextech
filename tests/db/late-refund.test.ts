import { describe, it, expect, beforeAll } from "vitest";
import { createUser, makeProduct, serviceClient, type DB } from "./helpers";
import { handleStripeEvent, type WebhookDeps } from "@/lib/orders/webhook";
import { notifyOrder } from "@/lib/orders/notify";
import { getOrderAlerts } from "@/lib/data/admin/order-alerts";
import { confirmPayment, lateRefundDeps, listUnsettledRefunds, settleLateRefund, type RefundApi } from "@/lib/orders/late-refund";

// NXT-001 with the real SQL: only Stripe is faked. Stripe keeps the result of a failed idempotent
// request, so the fake replays a failure for a key that already failed, like the real API does.
function fakeStripe(failures = 0) {
  const state = { failures, refunds: [] as { id: string; amountMinor: number; status: string }[], keys: [] as string[], failedKeys: new Set<string>() };
  const api: RefundApi = {
    async list() {
      return state.refunds;
    },
    async create(p, key) {
      state.keys.push(key);
      if (state.failedKeys.has(key)) throw new Error("replayed failure");
      if (state.failures > 0) {
        state.failures -= 1;
        state.failedKeys.add(key);
        throw Object.assign(new Error("stripe is down"), { statusCode: 402 });
      }
      const r = { id: `re_${state.refunds.length + 1}_${p.paymentIntent}`, amountMinor: p.amountMinor, status: "succeeded" };
      state.refunds.push(r);
      return r;
    },
  };
  return { state, api };
}

let a: { id: string; client: DB };
let productId: string;
const address = { recipientName: "Ana Souza", cpf: "52998224725", phone: "11987654321", cep: "01310100", street: "Av. Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP" };

async function cancelledOrder(method: "card" | "boleto" = "card") {
  const svc = serviceClient();
  const { data, error } = await a.client.rpc("create_order_from_cart", { p_items: [{ productId, quantity: 1 }] as never, p_address: address as never, p_method: method, p_save_address: false, p_expected_total: null as never });
  if (error) throw error;
  const orderId = data![0].order_id;
  const pi = `pi_late_${orderId.slice(0, 8)}`;
  await svc.from("orders").update({ stripe_payment_intent_id: pi }).eq("id", orderId);
  expect((await svc.rpc("order_cancel_unpaid", { p_order: orderId })).data).toBe(true);
  return { orderId, pi, total: Number(data![0].total_minor) };
}

function harness(stripe: RefundApi) {
  const svc = serviceClient();
  const notes: string[] = [];
  const claimed = new Set<string>();
  const notify: WebhookDeps["notify"] = async (kind) => void notes.push(kind);
  const late = lateRefundDeps(svc, stripe, notify);
  const d: WebhookDeps = {
    claimEvent: async (id) => !claimed.has(id) && !!claimed.add(id),
    releaseEvent: async (id) => void claimed.delete(id),
    markProcessed: async () => {},
    paymentDetails: async () => ({ feeMinor: 100, summary: "Cartão final 4242" }),
    orderAmount: async () => ({ totalMinor: 24990, currency: "BRL" }),
    markPaid: (pi, id, fee, summary) => confirmPayment(svc, pi, id, fee, summary),
    paidAfterCancel: async (pi, id) => void (await settleLateRefund(late, id, pi)),
    listRefunds: async () => [],
    cancelByPaymentIntent: async () => null,
    recordRefund: async () => null,
    addEvent: async () => null,
    notify,
  };
  return { svc, d, late, notes };
}

const succeeded = (id: string, pi: string, orderId: string) => ({ id, type: "payment_intent.succeeded", data: { object: { object: "payment_intent", id: pi, amount_received: 24990, amount: 24990, currency: "brl", metadata: { order_id: orderId } } } });
const kinds = async (orderId: string) => ((await serviceClient().from("order_events").select("kind").eq("order_id", orderId).order("at")).data ?? []).map((e) => e.kind);

beforeAll(async () => {
  a = await createUser("late-refund@nextech.local");
  const p = await makeProduct({ name: "Fone Tardio" });
  productId = p.id;
  const svc = serviceClient();
  await svc.from("products").update({ sale_mode: "own" }).eq("id", p.id);
  await svc.from("product_sale").upsert({ product_id: p.id, price_minor: 24990 });
});

describe("payment on a cancelled order", () => {
  it("refunds on the Stripe retry after the first refund failed", async () => {
    const { orderId, pi } = await cancelledOrder();
    const stripe = fakeStripe(1);
    const h = harness(stripe.api);
    const event = succeeded("evt_late_1", pi, orderId);
    await expect(handleStripeEvent(event, h.d)).rejects.toThrow("stripe is down");
    expect(h.notes).toEqual(["ownerAlert"]);
    expect(await handleStripeEvent(event, h.d)).toBe("processed");
    const { data: o } = await h.svc.from("orders").select("status, refunded_minor").eq("id", orderId).single();
    expect(o).toEqual({ status: "refunded", refunded_minor: 24990 });
    expect(stripe.state.refunds).toHaveLength(1);
    expect(new Set(stripe.state.keys).size).toBe(2); // a new key: Stripe would replay the stored failure
    expect(await kinds(orderId)).toEqual(expect.arrayContaining(["paid_after_cancel", "refund_failed", "refunded"]));
    expect(h.notes).toEqual(["ownerAlert", "orderRefunded"]);
  });
  it("never refunds twice: a redelivery after success is a no-op", async () => {
    const { orderId, pi } = await cancelledOrder();
    const stripe = fakeStripe(0);
    const h = harness(stripe.api);
    await handleStripeEvent(succeeded("evt_late_2", pi, orderId), h.d);
    await handleStripeEvent(succeeded("evt_late_3", pi, orderId), h.d);
    expect(stripe.state.refunds).toHaveLength(1);
    expect(stripe.state.keys).toHaveLength(1);
  });
  it("adopts a refund Stripe made even though the first attempt never heard back", async () => {
    const { orderId, pi, total } = await cancelledOrder();
    const stripe = fakeStripe(0);
    stripe.state.refunds.push({ id: `re_lost_${orderId}`, amountMinor: total, status: "pending" });
    const h = harness(stripe.api);
    await handleStripeEvent(succeeded("evt_late_4", pi, orderId), h.d);
    expect(stripe.state.keys).toHaveLength(0);
    const { data } = await h.svc.from("order_refunds").select("stripe_refund_id, status").eq("order_id", orderId);
    expect(data).toEqual([{ stripe_refund_id: `re_lost_${orderId}`, status: "pending" }]);
    expect((await listUnsettledRefunds(h.svc)).map((u) => u.orderId)).not.toContain(orderId);
  });
  it("a boleto paid after the cancellation alerts once, and a retry alerts no more", async () => {
    const { orderId, pi } = await cancelledOrder("boleto");
    const stripe = fakeStripe(0);
    const h = harness(stripe.api);
    await handleStripeEvent(succeeded("evt_late_5", pi, orderId), h.d);
    await handleStripeEvent(succeeded("evt_late_6", pi, orderId), h.d);
    expect(stripe.state.keys).toHaveLength(0);
    expect(h.notes).toEqual(["ownerManualRefund"]);
    expect((await kinds(orderId)).filter((k) => k === "manual_refund_pending")).toHaveLength(1);
  });
  it("the daily sweep finishes what the webhook retries could not", async () => {
    const { orderId, pi } = await cancelledOrder();
    const dead = fakeStripe(1);
    const h = harness(dead.api);
    await expect(handleStripeEvent(succeeded("evt_late_7", pi, orderId), h.d)).rejects.toThrow();
    expect((await listUnsettledRefunds(h.svc)).find((u) => u.orderId === orderId)).toMatchObject({ outstandingMinor: 24990, paymentMethod: "card" });
    const live = fakeStripe(0);
    const { late } = harness(live.api);
    expect(await settleLateRefund(late, orderId)).toBe("refunded");
    expect(live.state.refunds).toHaveLength(1);
    expect((await listUnsettledRefunds(h.svc)).map((u) => u.orderId)).not.toContain(orderId);
  });
  it("reaches the admin panel with no e-mail provider at all, and clears once the money is back", async () => {
    delete process.env.RESEND_API_KEY;
    const { orderId, pi } = await cancelledOrder();
    const svc = serviceClient();
    const dead = fakeStripe(1);
    const late = lateRefundDeps(svc, dead.api, notifyOrder);
    await expect(handleStripeEvent(succeeded("evt_late_8", pi, orderId), { ...harness(dead.api).d, paidAfterCancel: async (p, id) => void (await settleLateRefund(late, id, p)) })).rejects.toThrow();
    const { data: order } = await svc.from("orders").select("number").eq("id", orderId).single();
    const { alerts } = await getOrderAlerts();
    expect(alerts.filter((x) => x.number === order!.number)).toEqual([expect.objectContaining({ key: `owed:${orderId}` })]);
    const { data: ev } = await svc.from("order_events").select("data").eq("order_id", orderId).eq("kind", "owner_alert").single();
    expect(ev!.data).toMatchObject({ template: "ownerAlert", emailed: false });
    await settleLateRefund(lateRefundDeps(svc, fakeStripe(0).api, notifyOrder), orderId);
    expect((await getOrderAlerts()).alerts.filter((x) => x.number === order!.number)).toEqual([]);
  });
});
