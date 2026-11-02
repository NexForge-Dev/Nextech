import Stripe from "stripe";
import type { StripeEventLike } from "@/lib/orders/webhook";

// Signature checks need no API key; a placeholder keeps the SDK constructor happy.
const sdk = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_unused_for_signature_checks");

/** Verify the Stripe-Signature header against the raw request body. */
export function verifyStripeEvent(rawBody: string, signature: string | null, secret: string | undefined): { ok: true; event: StripeEventLike } | { ok: false } {
  if (!signature || !secret) return { ok: false };
  try {
    return { ok: true, event: sdk.webhooks.constructEvent(rawBody, signature, secret) as unknown as StripeEventLike };
  } catch {
    return { ok: false };
  }
}
