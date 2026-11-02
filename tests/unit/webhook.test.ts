import { describe, it, expect } from "vitest";
import { handleStripeEvent, type WebhookDeps } from "@/lib/orders/webhook";

type Ev = { id: string; type: string; data: { object: Record<string, unknown> } };
const ev = (id: string, type: string, object: Record<string, unknown>): Ev => ({ id, type, data: { object } });
const pi = (status = "succeeded") => ({ id: "pi_1", object: "payment_intent", status, metadata: { order_id: "o1" }, latest_charge: "ch_1", last_payment_error: { message: "Cartão recusado" } });

function fake() {
  const state = {
    claimed: new Set<string>(),
    status: "awaiting_payment" as string,
    refunds: new Map<string, number>(),
    notes: [] as string[],
    events: [] as string[],
  };
  const d: WebhookDeps = {
    claimEvent: async (id) => (state.claimed.has(id) ? false : (state.claimed.add(id), true)),
    releaseEvent: async (id) => void state.claimed.delete(id),
    markProcessed: async () => {},
    paymentDetails: async () => ({ feeMinor: 1794, summary: "Cartão final 4242" }),
    markPaid: async () => {
      if (state.status === "cancelled") return { orderId: "o1", transitioned: false, wasCancelled: true };
      if (state.status !== "awaiting_payment") return { orderId: "o1", transitioned: false };
      state.status = "awaiting_supplier";
      return { orderId: "o1", transitioned: true };
    },
    cancelByPaymentIntent: async () => {
      if (state.status !== "awaiting_payment") return null;
      state.status = "cancelled";
      return { orderId: "o1" };
    },
    recordRefund: async (r) => {
      state.refunds.set(r.stripeRefundId, r.amountMinor);
      const total = [...state.refunds.values()].reduce((a, b) => a + b, 0);
      if (total >= 43980) state.status = "refunded";
      return { orderId: "o1", fullyRefunded: total >= 43980, changed: true };
    },
    paidAfterCancel: async (_pi, orderId) => void state.notes.push(`paidAfterCancel ${orderId}`),
    listRefunds: async () => [{ id: "re_listed", amount: 43980, status: "succeeded" }],
    addEvent: async (_pi, kind) => (state.events.push(kind), { orderId: "o1" }),
    notify: async (kind) => void state.notes.push(kind),
  };
  return { d, state };
}

describe("handleStripeEvent", () => {
  it("marks the order paid once and sends one confirmation for duplicate deliveries", async () => {
    const { d, state } = fake();
    const e = ev("evt_1", "payment_intent.succeeded", pi());
    expect(await handleStripeEvent(e as never, d)).toBe("processed");
    expect(await handleStripeEvent(e as never, d)).toBe("duplicate");
    expect(state.status).toBe("awaiting_supplier");
    expect(state.notes).toEqual(["orderConfirmed", "ownerNewOrder"]);
  });
  it("is idempotent when Stripe sends the same success under two event ids", async () => {
    const { d, state } = fake();
    await handleStripeEvent(ev("evt_1", "payment_intent.succeeded", pi()) as never, d);
    await handleStripeEvent(ev("evt_2", "payment_intent.succeeded", pi()) as never, d);
    expect(state.notes.filter((n) => n === "orderConfirmed")).toHaveLength(1);
  });
  it("a failed attempt followed by success ends paid", async () => {
    const { d, state } = fake();
    await handleStripeEvent(ev("evt_f", "payment_intent.payment_failed", pi("requires_payment_method")) as never, d);
    expect(state.status).toBe("awaiting_payment");
    await handleStripeEvent(ev("evt_s", "payment_intent.succeeded", pi()) as never, d);
    expect(state.status).toBe("awaiting_supplier");
    expect(state.events).toContain("payment_failed");
  });
  it("cancels an unpaid order when the payment intent is canceled (e.g. expired boleto)", async () => {
    const { d, state } = fake();
    await handleStripeEvent(ev("evt_c", "payment_intent.canceled", pi("canceled")) as never, d);
    expect(state.status).toBe("cancelled");
  });
  it("syncs refunds from charge.refunded and marks a full refund", async () => {
    const { d, state } = fake();
    state.status = "awaiting_supplier";
    const charge = { id: "ch_1", object: "charge", payment_intent: "pi_1", amount_refunded: 43980, refunds: { data: [{ id: "re_1", amount: 43980, status: "succeeded" }] } };
    await handleStripeEvent(ev("evt_r", "charge.refunded", charge) as never, d);
    expect(state.status).toBe("refunded");
    expect(state.notes).toContain("orderRefunded");
  });
  it("ignores events without an order", async () => {
    const { d } = fake();
    const r = await handleStripeEvent(ev("evt_x", "payment_intent.succeeded", { ...pi(), metadata: {} }) as never, d);
    expect(r).toBe("ignored");
  });
  it("releases the claim when processing fails so Stripe can retry", async () => {
    const { d, state } = fake();
    d.markPaid = async () => { throw new Error("db down"); };
    await expect(handleStripeEvent(ev("evt_e", "payment_intent.succeeded", pi()) as never, d)).rejects.toThrow("db down");
    expect(state.claimed.has("evt_e")).toBe(false);
  });
  it("alerts the owner on a dispute", async () => {
    const { d, state } = fake();
    await handleStripeEvent(ev("evt_d", "charge.dispute.created", { id: "dp_1", object: "dispute", payment_intent: "pi_1", amount: 43980 }) as never, d);
    expect(state.notes).toEqual(["ownerDispute"]);
    expect(state.events).toEqual(["dispute_created"]);
  });
  it("hands a payment that succeeded on a cancelled order to the refund path", async () => {
    const { d, state } = fake();
    state.status = "cancelled";
    await handleStripeEvent(ev("evt_pc", "payment_intent.succeeded", pi()) as never, d);
    expect(state.notes).toEqual(["paidAfterCancel o1"]);
  });
  it("cancels an order when an async payment (boleto/Pix) expires", async () => {
    const { d, state } = fake();
    const expired = { ...pi("requires_payment_method"), payment_method_types: ["boleto"] };
    await handleStripeEvent(ev("evt_x1", "payment_intent.payment_failed", expired) as never, d);
    expect(state.status).toBe("cancelled");
    expect(state.notes).toContain("paymentFailed");
  });
  it("keeps a declined card order open so the customer can retry", async () => {
    const { d, state } = fake();
    await handleStripeEvent(ev("evt_x2", "payment_intent.payment_failed", { ...pi("requires_payment_method"), payment_method_types: ["card"] }) as never, d);
    expect(state.status).toBe("awaiting_payment");
  });
  it("lists refunds from Stripe when charge.refunded carries none", async () => {
    const { d, state } = fake();
    state.status = "awaiting_supplier";
    await handleStripeEvent(ev("evt_r2", "charge.refunded", { id: "ch_1", object: "charge", payment_intent: "pi_1", amount_refunded: 43980 }) as never, d);
    expect(state.refunds.get("re_listed")).toBe(43980);
    expect(state.status).toBe("refunded");
  });
});
