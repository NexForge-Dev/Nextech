import { describe, it, expect } from "vitest";
import { cancelOrderWith, type CancelDeps } from "@/lib/orders/cancel";

type Row = { previous_status: string; payment_method: string; payment_intent: string | null; total_minor: number; refunded_minor?: number };
function deps(row: Row | Error, refundOk = true) {
  const log: string[] = [];
  const d: CancelDeps = {
    cancelInDb: async () => {
      if (row instanceof Error) throw row;
      return { order_id: "o1", refunded_minor: 0, ...row };
    },
    refund: async (pi, amount) => (log.push(`refund ${pi} ${amount}`), refundOk),
    cancelPaymentIntent: async (pi) => void log.push(`cancel ${pi}`),
    recordManualPending: async (orderId, amount) => void log.push(`manual ${orderId} ${amount}`),
    notify: async (kind, _o, extra) => void log.push(`notify ${kind}${extra?.refundMinor ? ` ${extra.refundMinor}` : ""}`),
  };
  return { d, log };
}

describe("cancelOrderWith", () => {
  it("refunds a paid card order in full, once", async () => {
    const { d, log } = deps({ previous_status: "awaiting_supplier", payment_method: "card", payment_intent: "pi_1", total_minor: 43980 });
    expect(await cancelOrderWith(d, 1001)).toEqual({ ok: true, refund: "stripe" });
    expect(log).toEqual(["refund pi_1 43980", "notify orderCancelled 43980"]);
  });
  it("cancels the payment of an unpaid order instead of refunding", async () => {
    const { d, log } = deps({ previous_status: "awaiting_payment", payment_method: "boleto", payment_intent: "pi_2", total_minor: 1000 });
    expect(await cancelOrderWith(d, 1001)).toEqual({ ok: true, refund: "none" });
    expect(log).toEqual(["cancel pi_2", "notify orderCancelled"]);
  });
  it("leaves a paid boleto for a manual refund and alerts the owner", async () => {
    const { d, log } = deps({ previous_status: "awaiting_supplier", payment_method: "boleto", payment_intent: "pi_3", total_minor: 9990 });
    expect(await cancelOrderWith(d, 1001)).toEqual({ ok: true, refund: "manual" });
    expect(log).toEqual(["manual o1 9990", "notify orderCancelled", "notify ownerManualRefund 9990"]);
  });
  it("refunds only what is left after an earlier partial refund", async () => {
    const { d, log } = deps({ previous_status: "awaiting_supplier", payment_method: "card", payment_intent: "pi_1", total_minor: 43980, refunded_minor: 10000 });
    expect(await cancelOrderWith(d, 1001)).toEqual({ ok: true, refund: "stripe" });
    expect(log).toEqual(["refund pi_1 33980", "notify orderCancelled 33980"]);
  });
  it("does not refund again an order that was already refunded in full", async () => {
    const { d, log } = deps({ previous_status: "awaiting_supplier", payment_method: "card", payment_intent: "pi_1", total_minor: 43980, refunded_minor: 43980 });
    expect(await cancelOrderWith(d, 1001)).toEqual({ ok: true, refund: "none" });
    expect(log).toEqual(["notify orderCancelled"]);
  });
  it("when the Stripe refund fails, never tells the customer it was refunded and alerts the owner", async () => {
    const { d, log } = deps({ previous_status: "awaiting_supplier", payment_method: "card", payment_intent: "pi_1", total_minor: 43980 }, false);
    expect(await cancelOrderWith(d, 1001)).toEqual({ ok: true, refund: "failed" });
    expect(log).toEqual(["refund pi_1 43980", "notify orderCancelled", "notify ownerAlert"]);
  });
  it("explains why an order can no longer be cancelled", async () => {
    const { d } = deps(new Error("already_purchased"));
    expect(await cancelOrderWith(d, 1001)).toEqual({ ok: false, error: "Este pedido já está sendo preparado e não pode mais ser cancelado. Abra uma solicitação de devolução ou suporte." });
  });
});
