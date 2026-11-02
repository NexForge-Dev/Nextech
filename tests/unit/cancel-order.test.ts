import { describe, it, expect } from "vitest";
import { cancelOrderWith, type CancelDeps } from "@/lib/orders/cancel";

function deps(row: { previous_status: string; payment_method: string; payment_intent: string | null; total_minor: number } | Error) {
  const log: string[] = [];
  const d: CancelDeps = {
    cancelInDb: async () => {
      if (row instanceof Error) throw row;
      return { order_id: "o1", ...row };
    },
    refund: async (pi, amount, key) => void log.push(`refund ${pi} ${amount} ${key}`),
    cancelPaymentIntent: async (pi) => void log.push(`cancel ${pi}`),
    recordManualPending: async (orderId) => void log.push(`manual ${orderId}`),
    notify: async (kind) => void log.push(`notify ${kind}`),
  };
  return { d, log };
}

describe("cancelOrderWith", () => {
  it("refunds a paid card order in full, once", async () => {
    const { d, log } = deps({ previous_status: "awaiting_supplier", payment_method: "card", payment_intent: "pi_1", total_minor: 43980 });
    expect(await cancelOrderWith(d, 1001)).toEqual({ ok: true, refund: "stripe" });
    expect(log).toEqual(["refund pi_1 43980 refund-cancel-o1", "notify orderCancelled"]);
  });
  it("cancels the payment of an unpaid order instead of refunding", async () => {
    const { d, log } = deps({ previous_status: "awaiting_payment", payment_method: "boleto", payment_intent: "pi_2", total_minor: 1000 });
    expect(await cancelOrderWith(d, 1001)).toEqual({ ok: true, refund: "none" });
    expect(log).toEqual(["cancel pi_2", "notify orderCancelled"]);
  });
  it("leaves a paid boleto for a manual refund and alerts the owner", async () => {
    const { d, log } = deps({ previous_status: "awaiting_supplier", payment_method: "boleto", payment_intent: "pi_3", total_minor: 9990 });
    expect(await cancelOrderWith(d, 1001)).toEqual({ ok: true, refund: "manual" });
    expect(log).toEqual(["manual o1", "notify orderCancelled", "notify ownerManualRefund"]);
  });
  it("explains why an order can no longer be cancelled", async () => {
    const { d } = deps(new Error("already_purchased"));
    expect(await cancelOrderWith(d, 1001)).toEqual({ ok: false, error: "Este pedido já está sendo preparado e não pode mais ser cancelado. Abra uma solicitação de devolução ou suporte." });
  });
});
