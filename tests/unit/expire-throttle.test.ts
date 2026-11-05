import { describe, it, expect, vi, beforeEach } from "vitest";

// Anonymous pages must not turn into Stripe calls on a shared account.
const rateLimit = vi.fn();
const staleList = vi.fn(async () => ({ data: [{ order_id: "o1", payment_intent: "pi_1", payment_method: "card" }], error: null }));
const retrieve = vi.fn(async () => ({ status: "processing" }));

vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabase: () => ({ rpc: staleList }) }));
vi.mock("@/lib/stripe/server", () => ({ isStripeConfigured: () => true, getStripe: () => ({ paymentIntents: { retrieve } }) }));
vi.mock("@/lib/orders/notify", () => ({ notifyOrder: vi.fn() }));

describe("releaseExpiredHolds", () => {
  beforeEach(() => {
    rateLimit.mockReset();
    retrieve.mockClear();
  });
  it("makes no Stripe call beyond one pass a minute, whoever is visiting", async () => {
    const { releaseExpiredHolds } = await import("@/lib/orders/expire");
    rateLimit.mockResolvedValueOnce(true).mockResolvedValue(false);
    for (let i = 0; i < 30; i++) await releaseExpiredHolds();
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(rateLimit).toHaveBeenCalledWith("expireHolds", "all-visitors");
  });
  it("checkout, already limited per customer, is not held back by anonymous traffic", async () => {
    const { releaseExpiredHolds } = await import("@/lib/orders/expire");
    rateLimit.mockResolvedValue(false);
    await releaseExpiredHolds({ force: true });
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(rateLimit).not.toHaveBeenCalled();
  });
});
