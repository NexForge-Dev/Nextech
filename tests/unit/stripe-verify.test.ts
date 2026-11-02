import { describe, it, expect } from "vitest";
import Stripe from "stripe";
import { verifyStripeEvent } from "@/lib/stripe/verify";

const secret = "whsec_test_secret";
const payload = JSON.stringify({ id: "evt_1", object: "event", type: "payment_intent.succeeded", data: { object: { id: "pi_1" } } });
const stripe = new Stripe("sk_test_dummy");

describe("verifyStripeEvent", () => {
  it("accepts a correctly signed payload", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(verifyStripeEvent(payload, header, secret)).toMatchObject({ ok: true, event: { id: "evt_1" } });
  });
  it("rejects a tampered payload", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(verifyStripeEvent(payload.replace("pi_1", "pi_2"), header, secret)).toEqual({ ok: false });
  });
  it("rejects a missing signature or secret", () => {
    expect(verifyStripeEvent(payload, null, secret)).toEqual({ ok: false });
    expect(verifyStripeEvent(payload, "t=1,v1=x", "")).toEqual({ ok: false });
  });
});
