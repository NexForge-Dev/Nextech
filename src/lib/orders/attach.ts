import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Only an order still awaiting payment takes a payment. Another tab may have cancelled it while Stripe
 * answered: throwing lets the caller cancel this PaymentIntent, so it can never be paid and refunded.
 */
export async function attachPaymentIntentToOrder(svc: SupabaseClient<Database>, orderId: string, paymentIntentId: string, boleto: unknown) {
  const { data, error } = await svc.from("orders").update({ stripe_payment_intent_id: paymentIntentId, boleto: boleto as never }).eq("id", orderId).eq("status", "awaiting_payment").select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("order_not_open");
}
