import type { EmailKind } from "@/lib/email/templates";

export type StaleOrder = { orderId: string; paymentIntent: string | null; paymentMethod: string };

export type StaleDeps = {
  /** Unpaid orders past their window (boleto 7 days, card/Pix 1 day). */
  listStale(): Promise<StaleOrder[]>;
  /** The payment's status at Stripe; null when Stripe is not configured. Throws when Stripe cannot be reached. */
  paymentStatus(paymentIntentId: string): Promise<string | null>;
  cancelPaymentIntent(paymentIntentId: string): Promise<void>;
  /** Cancels only if the order is still awaiting payment. */
  cancelInDb(orderId: string): Promise<boolean>;
  notify(kind: EmailKind, orderId: string): Promise<void>;
};

/** Payments that may still turn into money: never cancel their order. */
const IN_FLIGHT = new Set(["processing", "succeeded", "requires_capture"]);

/**
 * Daily expiry of unpaid orders. Stripe is asked first and closes the payment before the order is
 * cancelled, so an order whose money is on its way (e.g. a boleto settling) is never cancelled.
 */
export async function cancelStaleOrdersWith(d: StaleDeps): Promise<{ cancelled: number; skipped: number }> {
  let cancelled = 0;
  let skipped = 0;
  for (const o of await d.listStale()) {
    if (o.paymentIntent) {
      let status: string | null;
      try {
        status = await d.paymentStatus(o.paymentIntent);
      } catch {
        skipped += 1;
        continue;
      }
      if (status && IN_FLIGHT.has(status)) {
        skipped += 1;
        continue;
      }
      if (status && status !== "canceled") {
        try {
          await d.cancelPaymentIntent(o.paymentIntent);
        } catch {
          skipped += 1; // Stripe refused: the payment moved on, its webhook decides
          continue;
        }
      }
    }
    if (await d.cancelInDb(o.orderId)) {
      cancelled += 1;
      await d.notify("paymentFailed", o.orderId);
    }
  }
  return { cancelled, skipped };
}
