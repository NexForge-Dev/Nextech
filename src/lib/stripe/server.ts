import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** Server-side Stripe client. The secret key never leaves the server. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set — add it to the environment (test key sk_test_… for development).");
  client ??= new Stripe(key, { appInfo: { name: "NEXTECH" }, maxNetworkRetries: 2 });
  return client;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
}

/**
 * Checkout may only take money when the webhook can confirm it: without the signing secret every
 * webhook is refused, so the customer is charged and the order is never marked paid.
 */
export function canTakePayments(): boolean {
  return isStripeConfigured() && !!process.env.STRIPE_WEBHOOK_SECRET?.trim();
}
