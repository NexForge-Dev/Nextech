/** Stripe's word on a card payment: it was tried and refused, so the customer needs a new attempt. */
export function isDeclinedPayment(pi: { status: string; last_payment_error?: unknown }): boolean {
  return pi.status === "requires_payment_method" && !!pi.last_payment_error;
}
