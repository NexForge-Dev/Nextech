import { describe, it, expect, vi, afterEach } from "vitest";
import { orderAlertsFrom, type AlertEvent } from "@/lib/orders/order-alerts";

const money = (m: number) => `R$ ${m}`;
const ev = (p: Partial<AlertEvent> & { data: AlertEvent["data"] }): AlertEvent => ({ orderId: "o1", number: 10, at: "2026-11-05T00:00:00Z", settled: false, ...p });

describe("orderAlertsFrom", () => {
  it("puts money still owed first", () => {
    const a = orderAlertsFrom([{ orderId: "o2", number: 20, paymentMethod: "card", outstandingMinor: 500 }], [ev({ data: { template: "ownerDispute" } })], money);
    expect(a.map((x) => x.number)).toEqual([20, 10]);
    expect(a[0].message).toContain("R$ 500");
  });
  it("shows the same alert once per order", () => {
    const e = ev({ data: { template: "ownerAlert", alert: "Valor divergente" } });
    expect(orderAlertsFrom([], [e, e], money)).toHaveLength(1);
  });
  it("drops refund alerts once the order is fully refunded, but keeps a dispute", () => {
    const a = orderAlertsFrom([], [ev({ settled: true, data: { template: "ownerManualRefund", refundMinor: 500 } }), ev({ settled: true, data: { template: "ownerDispute" } })], money);
    expect(a.map((x) => x.message)).toEqual([expect.stringContaining("Contestação")]);
  });
});

describe("canTakePayments", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("stays false while the webhook secret is missing, so checkout cannot charge blindly", async () => {
    const { canTakePayments, isStripeConfigured } = await import("@/lib/stripe/server");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "  ");
    expect(isStripeConfigured()).toBe(true);
    expect(canTakePayments()).toBe(false);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    expect(canTakePayments()).toBe(true);
  });
});
