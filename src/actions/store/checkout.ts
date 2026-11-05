"use server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { canTakePayments, getStripe } from "@/lib/stripe/server";
import { checkoutInputSchema, startCheckoutWith, type CheckoutResult } from "@/lib/orders/checkout";
import { customerStage, isOrderStatus, type CustomerStage } from "@/lib/domain/order-status";
import { log } from "@/lib/log";
import { notifyOrder } from "@/lib/orders/notify";
import { releaseExpiredHolds } from "@/lib/orders/expire";
import { analytics } from "@/lib/analytics";
import { getPublicSettings } from "@/lib/data/settings";
import { isSellerIdentified } from "@/lib/domain/seller";
import { readBirthDate, saveBirthDate } from "@/lib/data/birth-date";

export async function startCheckout(input: unknown): Promise<CheckoutResult & { fieldErrors?: Record<string, string[]> }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Entre na sua conta para finalizar a compra." };
  const parsed = checkoutInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (fieldErrors[i.path.join(".")] ??= []).push(i.message);
    return { ok: false, error: "Revise os dados destacados.", fieldErrors };
  }
  if (!canTakePayments()) return { ok: false, error: "Pagamentos ainda não configurados na loja. Tente mais tarde." };
  if (!isSellerIdentified((await getPublicSettings()).legal)) return { ok: false, error: "A loja ainda não está aberta para compras. Tente novamente mais tarde." };
  if (!(await rateLimit("checkout", user.id))) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };

  const sb = await createServerSupabase();
  const svc = createServiceSupabase();
  const stripe = getStripe();
  if (!(await saveBirthDate(sb, user.id, parsed.data.birthDate))) return { ok: false, error: "Não foi possível salvar seus dados. Tente novamente em instantes." };
  try {
    const result = await startCheckoutWith(
      {
        customerEmail: user.email,
        async openOrders() {
          const { data, error } = await svc
            .from("orders")
            .select("id, number, total_minor, payment_method, stripe_payment_intent_id, shipping, customer, order_items(product_id, quantity, stock_taken)")
            .eq("user_id", user.id)
            .eq("status", "awaiting_payment")
            .in("payment_method", ["card", "pix"])
            .order("created_at", { ascending: false })
            .limit(20);
          if (error) throw new Error(error.message);
          return (data ?? []).map((o) => ({
            orderId: o.id,
            orderNumber: Number(o.number),
            totalMinor: Number(o.total_minor),
            method: o.payment_method,
            paymentIntentId: o.stripe_payment_intent_id,
            address: { ...(o.shipping as Record<string, string>), ...(o.customer as Record<string, string>) },
            items: o.order_items.flatMap((i) => (i.product_id ? [{ productId: i.product_id, quantity: i.quantity, stockTaken: i.stock_taken }] : [])),
          }));
        },
        async retrievePaymentIntent(id) {
          return (await stripe.paymentIntents.retrieve(id)) as never;
        },
        async releaseOrder(o) {
          if (o.paymentIntentId) {
            const moved = await stripe.paymentIntents.cancel(o.paymentIntentId).then(
              () => false,
              (e: { code?: string; payment_intent?: { status?: string } }) => e?.payment_intent?.status !== "canceled",
            );
            if (moved) return false;
          }
          const { data, error } = await svc.rpc("order_cancel_unpaid", { p_order: o.orderId });
          if (error) throw new Error(error.message);
          return data === true;
        },
        releaseExpired: releaseExpiredHolds,
        async createOrder(i) {
          const { data, error } = await sb.rpc("create_order_from_cart", { p_items: i.items as never, p_address: i.address as never, p_method: i.method, p_save_address: i.saveAddress, ...(i.expectedTotalMinor ? { p_expected_total: i.expectedTotalMinor } : {}) });
          if (error) throw new Error(error.message);
          const row = data?.[0];
          if (!row) throw new Error("order_failed");
          return { orderId: row.order_id, orderNumber: Number(row.order_number), totalMinor: Number(row.total_minor) };
        },
        async attachPaymentIntent(orderId, paymentIntentId, boleto) {
          const { error } = await svc.from("orders").update({ stripe_payment_intent_id: paymentIntentId, boleto: boleto as never }).eq("id", orderId);
          if (error) throw new Error(error.message);
          if (boleto) {
            await svc.from("order_events").insert({ order_id: orderId, actor: "stripe", kind: "boleto_issued", data: { expiresAt: boleto.expiresAt } });
            await notifyOrder("boletoIssued", orderId);
          }
        },
        async abandonOrder(orderId, failure) {
          log.info("checkout.payment_refused", { orderId, code: failure.code, message: failure.message });
          // guarded: only an order still awaiting payment with no payment attached is cancelled
          const { data, error } = await svc
            .from("orders")
            .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
            .eq("id", orderId)
            .eq("status", "awaiting_payment")
            .is("stripe_payment_intent_id", null)
            .select("id");
          if (error) throw new Error(error.message);
          if (data?.length) {
            await svc.from("order_events").insert({ order_id: orderId, actor: "system", kind: "cancelled", data: { reason: "payment_refused", code: failure.code } });
          }
          if (failure.paymentIntentId) await stripe.paymentIntents.cancel(failure.paymentIntentId).catch(() => undefined);
        },
        stripe: {
          createPaymentIntent: async (params, opts) => (await stripe.paymentIntents.create(params as never, opts)) as never,
        },
      },
      parsed.data,
    );
    if (result.ok) {
      analytics.checkoutStarted(user.id);
      if (result.kind === "boleto") analytics.feature(user.id, "boleto_emitido");
    }
    return result;
  } catch (e) {
    log.error("checkout.failed", e);
    return { ok: false, error: "Não foi possível iniciar o pagamento. Tente novamente em instantes." };
  }
}

export type MyOrderStatus = { number: number; stage: CustomerStage; status: string; paymentMethod: string; totalMinor: number; boleto: { url: string; number: string | null; expiresAt: string | null } | null } | null;

/** Read-only status for the success page (it never marks anything paid). */
export async function getMyOrderStatus(orderNumber: number): Promise<MyOrderStatus> {
  if (!Number.isInteger(orderNumber) || orderNumber < 1) return null;
  const sb = await createServerSupabase();
  const { data } = await sb.from("my_orders").select("number, status, payment_method, total_minor, boleto").eq("number", orderNumber).maybeSingle();
  if (!data || !data.status || !isOrderStatus(data.status)) return null;
  return {
    number: Number(data.number),
    stage: customerStage(data.status),
    status: data.status,
    paymentMethod: data.payment_method ?? "card",
    totalMinor: Number(data.total_minor),
    boleto: (data.boleto as never) ?? null,
  };
}

export type SavedAddress = { id: string; recipientName: string; cpf: string; phone: string; cep: string; street: string; number: string; complement: string; district: string; city: string; state: string };

export async function getMyBirthDate(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return readBirthDate(await createServerSupabase(), user.id);
}

export async function getMyAddresses(): Promise<SavedAddress[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const sb = await createServerSupabase();
  const { data } = await sb.from("customer_addresses").select("*").order("is_default", { ascending: false }).order("created_at", { ascending: false }).limit(10);
  return (data ?? []).map((a) => ({ id: a.id, recipientName: a.recipient_name, cpf: a.cpf, phone: a.phone, cep: a.cep, street: a.street, number: a.number, complement: a.complement ?? "", district: a.district, city: a.city, state: a.state }));
}
