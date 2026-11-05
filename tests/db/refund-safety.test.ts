import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createUser, makeProduct, serviceClient, type DB } from "./helpers";
import { issueStripeRefund, lateRefundDeps, listUnsettledRefunds, MAX_REFUND_ATTEMPTS, recordStripeRefund, reconcileRefunds, settleLateRefund, type RefundApi, type StripeRefund } from "@/lib/orders/late-refund";
import { sweepConfig, sweepOwedRefunds, type SweepConfig } from "@/lib/orders/refund-sweep";
import { attachPaymentIntentToOrder } from "@/lib/orders/attach";
import { orderAlertsFrom } from "@/lib/orders/order-alerts";

// Real SQL; only Stripe is faked. Its refunds are shared, like the real account, and it accepts any
// refund that fits the charge, which is why two partial refunds would both go through.
const CHARGE = 24990;
function fakeStripe(opts: { status?: string; refuse?: number; hang?: Promise<void> } = {}) {
  const state = { refunds: [] as (StripeRefund & { pi: string })[], keys: [] as string[], refuse: opts.refuse ?? 0 };
  const api: RefundApi = {
    list: async (pi) => state.refunds.filter((r) => r.pi === pi),
    async create(p, key) {
      state.keys.push(key);
      if (opts.hang) await opts.hang;
      if (state.refuse > 0) {
        state.refuse -= 1;
        throw Object.assign(new Error("charge_disputed"), { statusCode: 400 });
      }
      const existing = state.refunds.find((r) => r.id === key);
      if (existing) return existing;
      const r = { id: key, pi: p.paymentIntent, amountMinor: p.amountMinor, status: opts.status ?? "succeeded" };
      state.refunds.push(r);
      return r;
    },
  };
  return { state, api };
}
const refunded = (s: ReturnType<typeof fakeStripe>) => s.state.refunds.reduce((sum, r) => sum + r.amountMinor, 0);

let a: { id: string; client: DB };
let productId: string;
const address = { recipientName: "Ana Souza", cpf: "52998224725", phone: "11987654321", cep: "01310100", street: "Av. Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP" };

async function order(kind: "paid" | "owed" = "owed", method: "card" | "boleto" = "card") {
  const svc = serviceClient();
  const { data, error } = await a.client.rpc("create_order_from_cart", { p_items: [{ productId, quantity: 1 }] as never, p_address: address as never, p_method: method, p_save_address: false, p_expected_total: null as never });
  if (error) throw error;
  const orderId = data![0].order_id;
  const pi = `pi_safe_${orderId}`;
  const now = new Date().toISOString();
  await svc.from("orders").update(kind === "owed" ? { status: "cancelled", cancelled_at: now, paid_at: now, stripe_payment_intent_id: pi } : { status: "awaiting_supplier", paid_at: now, stripe_payment_intent_id: pi }).eq("id", orderId);
  return { orderId, pi };
}
function harness(api: RefundApi) {
  const notes: string[] = [];
  return { notes, d: lateRefundDeps(serviceClient(), api, async (kind) => void notes.push(kind)) };
}
const kinds = async (id: string) => ((await serviceClient().from("order_events").select("kind").eq("order_id", id)).data ?? []).map((e) => e.kind);
const statusOf = async (id: string) => (await serviceClient().from("orders").select("status, refunded_minor").eq("id", id).single()).data!;
const manual = (id: string, amount: number) => serviceClient().rpc("order_record_refund", { p_order: id, p_pi: null as never, p_amount: amount, p_method: "manual", p_stripe_refund: null as never, p_status: "succeeded", p_note: null as never, p_actor: null as never });
const ON: SweepConfig = { enabled: true, maxOrders: 5, maxMinor: 200_000 };
const OFF: SweepConfig = { ...ON, enabled: false };

beforeAll(async () => {
  a = await createUser("refund-safety@nextech.local");
  const p = await makeProduct({ name: "Fone Seguro" });
  productId = p.id;
  const svc = serviceClient();
  await svc.from("products").update({ sale_mode: "own" }).eq("id", p.id);
  await svc.from("product_sale").upsert({ product_id: p.id, price_minor: CHARGE });
});

beforeEach(async () => {
  // each test owns the whole debt list
  await serviceClient().from("orders").update({ status: "refunded" }).eq("status", "cancelled").not("paid_at", "is", null);
  await serviceClient().from("rate_limits").delete().neq("key", "");
});

describe("sweep switch", () => {
  it("is off unless asked for, and stays off without the webhook secret", () => {
    expect(sweepConfig({}, true).enabled).toBe(false);
    expect(sweepConfig({ AUTO_REFUND_SWEEP: "off" }, true).enabled).toBe(false);
    expect(sweepConfig({ AUTO_REFUND_SWEEP: "on" }, true).enabled).toBe(true);
    expect(sweepConfig({ AUTO_REFUND_SWEEP: "on" }, false).enabled).toBe(false);
  });
  it("a bad cap falls back to the safe default, never to no cap", () => {
    for (const v of ["", "abc", "0", "-1", "1.5"]) expect(sweepConfig({ AUTO_REFUND_MAX_ORDERS: v, AUTO_REFUND_MAX_MINOR: v }, true)).toMatchObject({ maxOrders: 5, maxMinor: 200_000 });
    expect(sweepConfig({ AUTO_REFUND_MAX_ORDERS: "2", AUTO_REFUND_MAX_MINOR: "30000" }, true)).toMatchObject({ maxOrders: 2, maxMinor: 30_000 });
  });
});

describe("sweep off (the default)", () => {
  it("moves no money, alerts once per order, keeps everything listed", async () => {
    const { orderId } = await order();
    const stripe = fakeStripe();
    const h = harness(stripe.api);
    const first = await sweepOwedRefunds(serviceClient(), h.d, OFF, true);
    const second = await sweepOwedRefunds(serviceClient(), h.d, OFF, true);
    expect(stripe.state.keys).toEqual([]);
    expect(first).toMatchObject({ mode: "off", owed: 1, owedMinor: CHARGE, refunded: 0, left: 1 });
    expect(second).toMatchObject({ owed: 1, refunded: 0 });
    expect(h.notes).toEqual(["ownerAlert"]);
    expect((await listUnsettledRefunds(serviceClient())).map((o) => o.orderId)).toEqual([orderId]);
  });
  it("the admin can still refund that one order deliberately", async () => {
    const { orderId, pi } = await order();
    const stripe = fakeStripe();
    const h = harness(stripe.api);
    await sweepOwedRefunds(serviceClient(), h.d, OFF, true);
    expect(await issueStripeRefund(h.d, { orderId, paymentIntent: pi, source: "admin", amountMinor: CHARGE })).toMatchObject({ outcome: "created", confirmed: true });
    expect(await statusOf(orderId)).toEqual({ status: "refunded", refunded_minor: CHARGE });
    expect(await listUnsettledRefunds(serviceClient())).toEqual([]);
  });
  it("a pending refund whose webhook was lost comes back as owed, in the panel, without moving money", async () => {
    const { orderId, pi } = await order();
    const svc = serviceClient();
    await recordStripeRefund(svc, { orderId }, { id: `re_lost_${orderId}`, amountMinor: CHARGE, status: "pending" });
    await svc.from("order_refunds").update({ created_at: new Date(Date.now() - 2 * 3_600_000).toISOString() }).eq("order_id", orderId);
    expect(await listUnsettledRefunds(svc)).toEqual([]);
    const stripe = fakeStripe();
    stripe.state.refunds.push({ id: `re_lost_${orderId}`, pi, amountMinor: CHARGE, status: "failed" });
    expect(await sweepOwedRefunds(svc, harness(stripe.api).d, OFF, true)).toMatchObject({ owed: 1, owedMinor: CHARGE });
    expect(stripe.state.keys).toEqual([]);
    expect(await kinds(orderId)).toContain("refund_failed");
  });
});

describe("sweep on", () => {
  it("skips an open dispute, alerting once, and refunds nothing for it", async () => {
    const { orderId } = await order();
    await serviceClient().from("order_events").insert({ order_id: orderId, actor: "stripe", kind: "dispute_created", data: {} });
    const stripe = fakeStripe();
    const h = harness(stripe.api);
    await sweepOwedRefunds(serviceClient(), h.d, ON, true);
    await sweepOwedRefunds(serviceClient(), h.d, ON, true);
    expect(stripe.state.keys).toEqual([]);
    expect(h.notes).toEqual(["ownerAlert"]);
    expect((await listUnsettledRefunds(serviceClient()))[0]).toMatchObject({ disputed: true });
  });
  it("never passes the cap on orders; the rest stay listed", async () => {
    for (let i = 0; i < 4; i++) await order();
    const stripe = fakeStripe();
    expect(await sweepOwedRefunds(serviceClient(), harness(stripe.api).d, { ...ON, maxOrders: 2 }, true)).toMatchObject({ owed: 4, refunded: 2, refundedMinor: 2 * CHARGE, left: 2 });
    expect(stripe.state.refunds).toHaveLength(2);
    expect(await listUnsettledRefunds(serviceClient())).toHaveLength(2);
  });
  it("never passes the cap on value, not even by one order", async () => {
    for (let i = 0; i < 3; i++) await order();
    const stripe = fakeStripe();
    await sweepOwedRefunds(serviceClient(), harness(stripe.api).d, { ...ON, maxMinor: CHARGE * 2 - 1 }, true);
    expect(refunded(stripe)).toBe(CHARGE);
  });
  it("a failed attempt counts against the cap, so failures cannot widen the run", async () => {
    for (let i = 0; i < 3; i++) await order();
    const stripe = fakeStripe({ refuse: 1 });
    await sweepOwedRefunds(serviceClient(), harness(stripe.api).d, { ...ON, maxOrders: 2 }, true);
    expect(stripe.state.keys).toHaveLength(2);
  });
  it("with Stripe unavailable it moves nothing", async () => {
    await order();
    const stripe = fakeStripe();
    await sweepOwedRefunds(serviceClient(), harness(stripe.api).d, ON, false);
    expect(stripe.state.keys).toEqual([]);
  });
});

describe("one refund at a time, from any source", () => {
  it("a partial balance cannot be paid twice by two sources", async () => {
    const { orderId, pi } = await order();
    await manual(orderId, CHARGE - 3000); // R$ 3 still owed; both refunds would fit the charge
    let free = () => {};
    const stripe = fakeStripe({ hang: new Promise((r) => (free = r)) });
    const { d } = harness(stripe.api);
    const cron = issueStripeRefund(d, { orderId, paymentIntent: pi, source: "cron" });
    await expect.poll(() => stripe.state.keys.length).toBe(1);
    expect(await issueStripeRefund(d, { orderId, paymentIntent: pi, source: "admin", amountMinor: 3000 })).toEqual({ outcome: "busy" });
    expect(await issueStripeRefund(d, { orderId, paymentIntent: pi, source: "customer", amountMinor: 3000 })).toEqual({ outcome: "busy" });
    free();
    await cron;
    expect(await issueStripeRefund(d, { orderId, paymentIntent: pi, source: "admin", amountMinor: 3000 })).toEqual({ outcome: "nothing_owed" });
    expect(refunded(stripe)).toBe(3000);
  });
  it("two simultaneous sources: one refund, whichever wins", async () => {
    const { orderId, pi } = await order();
    await manual(orderId, CHARGE - 3000);
    const stripe = fakeStripe();
    const { d } = harness(stripe.api);
    await Promise.all((["cron", "webhook", "admin", "customer"] as const).map((source) => issueStripeRefund(d, { orderId, paymentIntent: pi, source })));
    expect(refunded(stripe)).toBe(3000);
  });
  it("an amount above the balance is refused, counting what Stripe is still processing", async () => {
    const { orderId, pi } = await order();
    const stripe = fakeStripe({ status: "pending" });
    const { d } = harness(stripe.api);
    await issueStripeRefund(d, { orderId, paymentIntent: pi, source: "admin", amountMinor: 20000 });
    expect(await issueStripeRefund(d, { orderId, paymentIntent: pi, source: "admin", amountMinor: 20000 })).toEqual({ outcome: "exceeds", availableMinor: CHARGE - 20000 });
  });
  it("when Stripe's answer is unknown the claim stays, so nobody refunds on top of it", async () => {
    const { orderId, pi } = await order();
    const unknown: RefundApi = { list: async () => [], create: async () => Promise.reject(new Error("socket hang up")) };
    await expect(issueStripeRefund(harness(unknown).d, { orderId, paymentIntent: pi, source: "webhook" })).rejects.toThrow("socket hang up");
    const stripe = fakeStripe();
    expect(await issueStripeRefund(harness(stripe.api).d, { orderId, paymentIntent: pi, source: "admin" })).toEqual({ outcome: "busy" });
    await serviceClient().from("order_refund_claims" as never).update({ expires_at: new Date(Date.now() - 1000).toISOString() } as never).eq("order_id", orderId);
    expect(await issueStripeRefund(harness(stripe.api).d, { orderId, paymentIntent: pi, source: "admin" })).toMatchObject({ outcome: "created" });
  });
  it("a definite refusal frees the order at once", async () => {
    const { orderId, pi } = await order();
    const stripe = fakeStripe({ refuse: 1 });
    const { d } = harness(stripe.api);
    await expect(issueStripeRefund(d, { orderId, paymentIntent: pi, source: "webhook" })).rejects.toThrow("charge_disputed");
    expect(await issueStripeRefund(d, { orderId, paymentIntent: pi, source: "admin" })).toMatchObject({ outcome: "created" });
  });
  it("a claim cannot be released by someone who does not hold it", async () => {
    const { orderId } = await order();
    const svc = serviceClient();
    const { data: token } = await svc.rpc("order_refund_claim", { p_order: orderId, p_source: "cron" });
    await svc.rpc("order_refund_release", { p_order: orderId, p_token: "00000000-0000-4000-8000-000000000000" });
    expect((await svc.rpc("order_refund_claim", { p_order: orderId, p_source: "admin" })).data).toBeNull();
    await svc.rpc("order_refund_release", { p_order: orderId, p_token: token! });
    expect((await svc.rpc("order_refund_claim", { p_order: orderId, p_source: "admin" })).data).not.toBeNull();
  });
  it("browser roles cannot touch the claim", async () => {
    const { orderId } = await order();
    expect((await a.client.rpc("order_refund_claim", { p_order: orderId, p_source: "admin" })).error).not.toBeNull();
    expect((await a.client.from("order_refund_claims" as never).select("*")).data ?? []).toEqual([]);
  });
});

describe("attempts and e-mails", () => {
  it("a dead refund is recorded, so the debt stays visible and is retried", async () => {
    const { orderId, pi } = await order();
    const svc = serviceClient();
    await recordStripeRefund(svc, { orderId }, { id: `re_dead_${orderId}`, amountMinor: CHARGE, status: "pending" });
    const stripe = fakeStripe();
    stripe.state.refunds.push({ id: `re_dead_${orderId}`, pi, amountMinor: CHARGE, status: "failed" });
    expect(await reconcileRefunds(harness(stripe.api).d, orderId, pi)).toBe(true);
    expect((await svc.from("order_refunds").select("status").eq("stripe_refund_id", `re_dead_${orderId}`).single()).data?.status).toBe("failed");
    expect((await listUnsettledRefunds(svc)).map((o) => o.orderId)).toEqual([orderId]);
  });
  it("refunds that keep failing stop at the limit, with one alert and no 'refunded' e-mail", async () => {
    const { orderId, pi } = await order();
    const stripe = fakeStripe({ status: "pending" });
    const h = harness(stripe.api);
    for (let day = 0; day < MAX_REFUND_ATTEMPTS + 3; day++) {
      await settleLateRefund(h.d, orderId, pi).catch(() => undefined);
      for (const r of stripe.state.refunds) r.status = "failed";
    }
    await settleLateRefund(h.d, orderId, pi).catch(() => undefined);
    expect(stripe.state.refunds.length).toBeLessThanOrEqual(MAX_REFUND_ATTEMPTS);
    expect(h.notes.filter((n) => n === "orderRefunded")).toEqual([]);
    expect((await listUnsettledRefunds(serviceClient()))[0]).toMatchObject({ orderId, attempts: MAX_REFUND_ATTEMPTS });
  });
  it("Stripe refusing for good stops at the limit without a retry loop, alerting once", async () => {
    const { orderId, pi } = await order();
    const stripe = fakeStripe({ refuse: 99 });
    const h = harness(stripe.api);
    const outcomes: string[] = [];
    for (let i = 0; i < MAX_REFUND_ATTEMPTS + 2; i++) outcomes.push(await settleLateRefund(h.d, orderId, pi).catch(() => "thrown"));
    expect(outcomes).toEqual(["thrown", "thrown", "exhausted", "exhausted", "exhausted"]);
    expect(stripe.state.keys).toHaveLength(MAX_REFUND_ATTEMPTS);
    expect(h.notes).toEqual(["ownerAlert"]);
  });
  it("the panel says when automatic attempts ran out", async () => {
    const [alert] = orderAlertsFrom([{ orderId: "o", number: 1, paymentMethod: "card", outstandingMinor: 100, disputed: false, attempts: MAX_REFUND_ATTEMPTS }], [], String);
    expect(alert.message).toContain("tentativas automáticas acabaram");
  });
  it("concurrent settlements send one e-mail and make one refund", async () => {
    const { orderId, pi } = await order();
    const stripe = fakeStripe();
    const h = harness(stripe.api);
    await Promise.all(Array.from({ length: 5 }, () => settleLateRefund(h.d, orderId, pi).catch(() => undefined)));
    expect(stripe.state.refunds).toHaveLength(1);
    expect(h.notes.filter((n) => n === "orderRefunded")).toEqual(["orderRefunded"]);
  });
  it("a pending refund sends no 'refunded' e-mail; it waits for Stripe's confirmation", async () => {
    const { orderId, pi } = await order();
    const h = harness(fakeStripe({ status: "pending" }).api);
    expect(await settleLateRefund(h.d, orderId, pi)).toBe("refunded");
    expect(h.notes).toEqual([]);
  });
  it("a boleto owes by hand: no Stripe call, in any mode", async () => {
    await order("owed", "boleto");
    const stripe = fakeStripe();
    await sweepOwedRefunds(serviceClient(), harness(stripe.api).d, ON, true);
    expect(stripe.state.keys).toEqual([]);
  });
});

describe("two tabs", () => {
  it("a payment cannot attach to an order another tab cancelled", async () => {
    const svc = serviceClient();
    const { data } = await a.client.rpc("create_order_from_cart", { p_items: [{ productId, quantity: 1 }] as never, p_address: address as never, p_method: "card", p_save_address: false, p_expected_total: null as never });
    const orderId = data![0].order_id;
    await svc.rpc("order_cancel_unpaid", { p_order: orderId });
    await expect(attachPaymentIntentToOrder(svc, orderId, `pi_tab_${orderId}`, null)).rejects.toThrow("order_not_open");
    expect((await svc.from("orders").select("stripe_payment_intent_id").eq("id", orderId).single()).data?.stripe_payment_intent_id).toBeNull();
  });
});
