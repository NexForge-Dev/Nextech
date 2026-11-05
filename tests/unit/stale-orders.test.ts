import { describe, it, expect } from "vitest";
import { cancelStaleOrdersWith, type StaleDeps } from "@/lib/orders/stale";

type Row = { orderId: string; paymentIntent: string | null; paymentMethod: string };

function deps(rows: Row[], stripe: Record<string, string | Error>, cancelFails: string[] = []) {
  const log: string[] = [];
  const d: StaleDeps = {
    listStale: async () => rows,
    paymentStatus: async (pi) => {
      const s = stripe[pi];
      if (s instanceof Error) throw s;
      return s ?? null;
    },
    cancelPaymentIntent: async (pi) => {
      if (cancelFails.includes(pi)) throw new Error("payment_intent_unexpected_state");
      log.push(`stripe-cancel ${pi}`);
    },
    cancelInDb: async (id) => (log.push(`db-cancel ${id}`), true),
    notify: async (kind, id) => void log.push(`notify ${kind} ${id}`),
    paymentStuck: async (o) => void log.push(`stuck ${o.orderId}`),
  };
  return { d, log };
}

describe("cancelStaleOrdersWith", () => {
  it("cancels an abandoned payment at Stripe first, then the order", async () => {
    const { d, log } = deps([{ orderId: "o1", paymentIntent: "pi_1", paymentMethod: "card" }], { pi_1: "requires_payment_method" });
    expect(await cancelStaleOrdersWith(d)).toEqual({ cancelled: 1, skipped: 0 });
    expect(log).toEqual(["stripe-cancel pi_1", "db-cancel o1", "notify paymentFailed o1"]);
  });
  it("keeps a boleto whose payment is still settling", async () => {
    const { d, log } = deps([{ orderId: "o2", paymentIntent: "pi_2", paymentMethod: "boleto" }], { pi_2: "processing" });
    expect(await cancelStaleOrdersWith(d)).toEqual({ cancelled: 0, skipped: 1 });
    expect(log).toEqual([]);
  });
  it("keeps an order whose payment already succeeded (the webhook marks it paid)", async () => {
    const { d, log } = deps([{ orderId: "o3", paymentIntent: "pi_3", paymentMethod: "card" }], { pi_3: "succeeded" });
    expect(await cancelStaleOrdersWith(d)).toEqual({ cancelled: 0, skipped: 1 });
    expect(log).toEqual(["stuck o3"]);
  });
  it("keeps the order when Stripe refuses the cancellation", async () => {
    const { d, log } = deps([{ orderId: "o4", paymentIntent: "pi_4", paymentMethod: "boleto" }], { pi_4: "requires_action" }, ["pi_4"]);
    expect(await cancelStaleOrdersWith(d)).toEqual({ cancelled: 0, skipped: 1 });
    expect(log).toEqual([]);
  });
  it("keeps the order when Stripe cannot be reached, to try again tomorrow", async () => {
    const { d, log } = deps([{ orderId: "o5", paymentIntent: "pi_5", paymentMethod: "card" }], { pi_5: new Error("network") });
    expect(await cancelStaleOrdersWith(d)).toEqual({ cancelled: 0, skipped: 1 });
    expect(log).toEqual([]);
  });
  it("cancels an order already canceled at Stripe, and one that never reached Stripe", async () => {
    const { d, log } = deps(
      [
        { orderId: "o6", paymentIntent: "pi_6", paymentMethod: "card" },
        { orderId: "o7", paymentIntent: null, paymentMethod: "card" },
      ],
      { pi_6: "canceled" },
    );
    expect(await cancelStaleOrdersWith(d)).toEqual({ cancelled: 2, skipped: 0 });
    expect(log).toEqual(["db-cancel o6", "notify paymentFailed o6", "db-cancel o7", "notify paymentFailed o7"]);
  });
});
