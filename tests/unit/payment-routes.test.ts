import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import Stripe from "stripe";
import { NextRequest } from "next/server";

// Route-level checks for /api/stripe/webhook and /api/cron/orders. The order logic itself
// (idempotency, refunds, cancellations) is covered in webhook.test.ts and stale-orders.test.ts.
const handleStripeEvent = vi.fn();
const cancelStaleOrdersWith = vi.fn();

vi.mock("@/lib/supabase/service", () => ({ createServiceSupabase: () => ({}) }));
vi.mock("@/lib/orders/notify", () => ({ notifyOrder: vi.fn() }));
vi.mock("@/lib/orders/webhook", () => ({ handleStripeEvent: (...a: unknown[]) => handleStripeEvent(...a) }));
vi.mock("@/lib/orders/stale", () => ({ cancelStaleOrdersWith: (...a: unknown[]) => cancelStaleOrdersWith(...a) }));
vi.mock("@/lib/orders/owed-refunds", () => ({ settleOwedRefunds: async () => ({ mode: "off", owed: 0, owedMinor: 0, refunded: 0, refundedMinor: 0, failed: 0, left: 0 }) }));

const secret = "whsec_route_test";
const payload = JSON.stringify({ id: "evt_route_1", object: "event", type: "payment_intent.succeeded", data: { object: { id: "pi_route_1", metadata: { order_id: "o1" } } } });
const signer = new Stripe("sk_test_dummy");

function webhookRequest(body: string, signature: string | null) {
  return new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body, headers: signature ? { "stripe-signature": signature } : {} });
}

beforeAll(() => {
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  process.env.CRON_SECRET = "cron-route-secret";
});

beforeEach(() => {
  handleStripeEvent.mockReset();
  cancelStaleOrdersWith.mockReset();
});

describe("POST /api/stripe/webhook", () => {
  it("answers 503 and logs an error when the signing secret is missing, unlike a bad signature", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.STRIPE_WEBHOOK_SECRET = "";
    const res = await POST(webhookRequest(payload, "t=1,v1=x"));
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    expect(res.status).toBe(503);
    expect(errors.mock.calls.flat().join(" ")).toContain("stripe.webhook_secret_missing");
    errors.mockRestore();
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("rejects a request without a signature and never processes it", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(webhookRequest(payload, null));
    expect(res.status).toBe(400);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("rejects a forged signature and a tampered body", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const forged = signer.webhooks.generateTestHeaderString({ payload, secret: "whsec_someone_else" });
    expect((await POST(webhookRequest(payload, forged))).status).toBe(400);
    const valid = signer.webhooks.generateTestHeaderString({ payload, secret });
    expect((await POST(webhookRequest(payload.replace("pi_route_1", "pi_evil"), valid))).status).toBe(400);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("rejects a signature older than Stripe's tolerance (replay)", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const old = signer.webhooks.generateTestHeaderString({ payload, secret, timestamp: Math.floor(Date.now() / 1000) - 60 * 60 });
    expect((await POST(webhookRequest(payload, old))).status).toBe(400);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("processes a correctly signed event and acknowledges with 200", async () => {
    handleStripeEvent.mockResolvedValue("processed");
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(webhookRequest(payload, signer.webhooks.generateTestHeaderString({ payload, secret })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, outcome: "processed" });
    expect(handleStripeEvent).toHaveBeenCalledTimes(1);
    expect(handleStripeEvent.mock.calls[0][0]).toMatchObject({ id: "evt_route_1", type: "payment_intent.succeeded" });
  });

  it("acknowledges a duplicate delivery with 200 so Stripe stops retrying", async () => {
    handleStripeEvent.mockResolvedValue("duplicate");
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(webhookRequest(payload, signer.webhooks.generateTestHeaderString({ payload, secret })));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: "duplicate" });
  });

  it("answers 500 when processing fails, so Stripe retries the event", async () => {
    handleStripeEvent.mockRejectedValue(new Error("db down"));
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(webhookRequest(payload, signer.webhooks.generateTestHeaderString({ payload, secret })));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/cron/orders", () => {
  it("refuses calls without the cron secret", async () => {
    const { GET } = await import("@/app/api/cron/orders/route");
    expect((await GET(new NextRequest("http://localhost/api/cron/orders"))).status).toBe(401);
    expect((await GET(new NextRequest("http://localhost/api/cron/orders", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect(cancelStaleOrdersWith).not.toHaveBeenCalled();
  });

  it("runs the stale-order sweep with the right secret", async () => {
    cancelStaleOrdersWith.mockResolvedValue({ cancelled: 1, skipped: 1 });
    const { GET } = await import("@/app/api/cron/orders/route");
    const res = await GET(new NextRequest("http://localhost/api/cron/orders", { headers: { authorization: "Bearer cron-route-secret" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, cancelled: 1 });
  });

  it("reports a failed sweep with 500", async () => {
    cancelStaleOrdersWith.mockRejectedValue(new Error("stripe down"));
    const { GET } = await import("@/app/api/cron/orders/route");
    const res = await GET(new NextRequest("http://localhost/api/cron/orders", { headers: { authorization: "Bearer cron-route-secret" } }));
    expect(res.status).toBe(500);
  });
});
