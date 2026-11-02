import { z } from "zod";
import { isValidCpf, onlyDigits } from "@/lib/domain/cpf";
import type { PaymentMethod } from "@/lib/domain/own-pricing";

const UF = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

const text = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);

export const addressSchema = z.object({
  recipientName: text(3, 120, "Informe o nome completo.").refine((v) => v.includes(" "), "Informe nome e sobrenome."),
  cpf: z.string().transform(onlyDigits).refine(isValidCpf, "CPF inválido."),
  phone: z.string().transform(onlyDigits).refine((v) => /^\d{10,11}$/.test(v), "Telefone com DDD (10 ou 11 dígitos)."),
  cep: z.string().transform(onlyDigits).refine((v) => /^\d{8}$/.test(v), "CEP com 8 dígitos."),
  street: text(2, 160, "Informe a rua."),
  number: text(1, 20, "Informe o número."),
  complement: z.string().trim().max(80).optional().default(""),
  district: text(2, 80, "Informe o bairro."),
  city: text(2, 80, "Informe a cidade."),
  state: z.string().trim().toUpperCase().refine((v) => (UF as readonly string[]).includes(v), "UF inválida."),
});
export type AddressInput = z.output<typeof addressSchema>;

export const checkoutInputSchema = z.object({
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(10) })).min(1, "Seu carrinho está vazio.").max(30),
  method: z.enum(["card", "boleto", "pix"]),
  saveAddress: z.boolean().default(false),
  address: addressSchema,
  /** Total the customer saw; the database refuses the order when prices changed meanwhile. */
  expectedTotalMinor: z.number().int().positive().optional(),
});
export type CheckoutInput = z.output<typeof checkoutInputSchema>;

export type BoletoInfo = { url: string; number: string | null; expiresAt: string | null };
export type PixInfo = { qrImageUrl: string; code: string; expiresAt: string | null };

type NextAction = {
  boleto_display_details?: { hosted_voucher_url?: string | null; number?: string | null; expires_at?: number | null } | null;
  pix_display_qr_code?: { image_url_png?: string | null; data?: string | null; expires_at?: number | null } | null;
};
type PI = { id: string; client_secret: string | null; status: string; next_action: NextAction | null };

export type CheckoutDeps = {
  createOrder(input: CheckoutInput): Promise<{ orderId: string; orderNumber: number; totalMinor: number }>;
  attachPaymentIntent(orderId: string, paymentIntentId: string, boleto: BoletoInfo | null): Promise<void>;
  customerEmail: string;
  stripe: { createPaymentIntent(params: Record<string, unknown>, opts: { idempotencyKey: string }): Promise<PI> };
};

export type CheckoutResult =
  | { ok: true; kind: "card"; orderNumber: number; totalMinor: number; clientSecret: string }
  | { ok: true; kind: "boleto"; orderNumber: number; totalMinor: number; boleto: BoletoInfo }
  | { ok: true; kind: "pix"; orderNumber: number; totalMinor: number; pix: PixInfo }
  | { ok: false; error: string; unavailableSlug?: string; priceChanged?: boolean };

const ERRORS: Record<string, string> = {
  cart_empty: "Seu carrinho está vazio.",
  method_disabled: "Esta forma de pagamento não está disponível.",
  amount_out_of_range: "O valor do pedido não é aceito nesta forma de pagamento (boleto: de R$ 5,00 a R$ 49.999,99).",
  store_closed: "A loja não está recebendo pedidos no momento.",
  not_signed_in: "Entre na sua conta para finalizar a compra.",
  invalid_quantity: "Quantidade inválida no carrinho.",
  duplicate_item: "Revise o carrinho e tente novamente.",
  cart_too_large: "O carrinho tem itens demais.",
  too_many_orders: "Você criou muitos pedidos sem pagamento na última hora. Pague um deles em Meus pedidos ou tente mais tarde.",
};

const isoFromUnix = (s: unknown) => (typeof s === "number" ? new Date(s * 1000).toISOString() : null);

/**
 * Create the order (prices from the database), then one PaymentIntent for exactly its total.
 * The idempotency key is the order id, so a retried request can never charge twice.
 * Card is confirmed in the browser (Payment Element); boleto and Pix are confirmed here and
 * return the voucher / QR code. Payment is only considered done by the Stripe webhook.
 */
export async function startCheckoutWith(d: CheckoutDeps, input: CheckoutInput): Promise<CheckoutResult> {
  let order: { orderId: string; orderNumber: number; totalMinor: number };
  try {
    order = await d.createOrder(input);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "price_changed") return { ok: false, error: "O preço de um produto mudou. Confira o novo total antes de pagar.", priceChanged: true };
    if (code.startsWith("item_unavailable:")) return { ok: false, error: "Um produto do carrinho esgotou ou saiu de linha. Revise o carrinho.", unavailableSlug: code.slice("item_unavailable:".length) };
    return { ok: false, error: ERRORS[code] ?? "Não foi possível criar o pedido. Tente novamente." };
  }
  const method: PaymentMethod = input.method;
  const a = input.address;
  const base: Record<string, unknown> = {
    amount: order.totalMinor,
    currency: "brl",
    payment_method_types: [method],
    receipt_email: d.customerEmail,
    description: `Pedido NEXTECH #${order.orderNumber}`,
    metadata: { order_id: order.orderId, order_number: String(order.orderNumber) },
  };
  if (method === "boleto" || method === "pix") {
    base.confirm = true;
    base.payment_method_data = {
      type: method,
      billing_details: {
        name: a.recipientName,
        email: d.customerEmail,
        address: { line1: `${a.street}, ${a.number}`, line2: a.complement || undefined, city: a.city, state: a.state, postal_code: a.cep, country: "BR" },
      },
      ...(method === "boleto" ? { boleto: { tax_id: a.cpf } } : {}),
    };
    base.payment_method_options = method === "boleto" ? { boleto: { expires_after_days: 3 } } : { pix: { expires_after_seconds: 3600 } };
  }
  const pi = await d.stripe.createPaymentIntent(base, { idempotencyKey: `order-${order.orderId}` });

  if (method === "boleto") {
    const b = pi.next_action?.boleto_display_details ?? {};
    const boleto: BoletoInfo = { url: String(b.hosted_voucher_url ?? ""), number: b.number ?? null, expiresAt: isoFromUnix(b.expires_at) };
    await d.attachPaymentIntent(order.orderId, pi.id, boleto);
    return { ok: true, kind: "boleto", orderNumber: order.orderNumber, totalMinor: order.totalMinor, boleto };
  }
  await d.attachPaymentIntent(order.orderId, pi.id, null);
  if (method === "pix") {
    const q = pi.next_action?.pix_display_qr_code ?? {};
    return { ok: true, kind: "pix", orderNumber: order.orderNumber, totalMinor: order.totalMinor, pix: { qrImageUrl: String(q.image_url_png ?? ""), code: String(q.data ?? ""), expiresAt: isoFromUnix(q.expires_at) } };
  }
  return { ok: true, kind: "card", orderNumber: order.orderNumber, totalMinor: order.totalMinor, clientSecret: pi.client_secret ?? "" };
}
