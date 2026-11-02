import { describe, it, expect } from "vitest";
import { checkoutInputSchema, startCheckoutWith, type CheckoutDeps } from "@/lib/orders/checkout";

const P = "11111111-1111-4111-8111-111111111111";
const ORDER = "99999999-9999-4999-8999-999999999999";
const input = {
  items: [{ productId: P, quantity: 2 }],
  method: "card" as const,
  saveAddress: false,
  address: { recipientName: "Ana Souza", cpf: "529.982.247-25", phone: "(11) 98765-4321", cep: "01310-100", street: "Av. Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP" },
};

function deps(over: Partial<CheckoutDeps> = {}) {
  const calls: { create: unknown[]; attach: unknown[] } = { create: [], attach: [] };
  const d: CheckoutDeps = {
    createOrder: async () => ({ orderId: ORDER, orderNumber: 1001, totalMinor: 49980 }),
    attachPaymentIntent: async (...a) => void calls.attach.push(a),
    customerEmail: "ana@example.com",
    stripe: {
      createPaymentIntent: async (params, opts) => {
        calls.create.push([params, opts]);
        return { id: "pi_1", client_secret: "pi_1_secret", status: "requires_payment_method", next_action: null };
      },
    },
    ...over,
  };
  return { d, calls };
}

describe("checkout input", () => {
  it("normalises CPF, phone and CEP to digits", () => {
    const r = checkoutInputSchema.safeParse(input);
    expect(r.success && r.data.address).toMatchObject({ cpf: "52998224725", phone: "11987654321", cep: "01310100", state: "SP" });
  });
  it("rejects an invalid CPF", () => {
    const r = checkoutInputSchema.safeParse({ ...input, address: { ...input.address, cpf: "111.111.111-11" } });
    expect(!r.success && r.error.issues[0].message).toBe("CPF inválido.");
  });
});

describe("startCheckoutWith", () => {
  it("charges exactly the order total computed by the database, once per order", async () => {
    const { d, calls } = deps();
    const r = await startCheckoutWith(d, checkoutInputSchema.parse(input));
    expect(r).toEqual({ ok: true, kind: "card", orderNumber: 1001, totalMinor: 49980, clientSecret: "pi_1_secret" });
    const [params, opts] = calls.create[0] as [Record<string, unknown>, { idempotencyKey: string }];
    expect(params).toMatchObject({ amount: 49980, currency: "brl", payment_method_types: ["card"], metadata: { order_id: ORDER, order_number: "1001" } });
    expect(opts.idempotencyKey).toBe(`order-${ORDER}`);
    expect(calls.attach).toEqual([[ORDER, "pi_1", null]]);
  });
  it("does not call Stripe when the database refuses the order", async () => {
    const { d, calls } = deps({ createOrder: async () => { throw new Error("method_disabled"); } });
    const r = await startCheckoutWith(d, checkoutInputSchema.parse(input));
    expect(r).toEqual({ ok: false, error: "Esta forma de pagamento não está disponível." });
    expect(calls.create).toHaveLength(0);
  });
  it("names the sold-out product", async () => {
    const { d } = deps({ createOrder: async () => { throw new Error("item_unavailable:fone-x"); } });
    expect(await startCheckoutWith(d, checkoutInputSchema.parse(input))).toEqual({ ok: false, error: "Um produto do carrinho esgotou ou saiu de linha. Revise o carrinho.", unavailableSlug: "fone-x" });
  });
  it("confirms boleto on the server with the customer's CPF and returns the voucher", async () => {
    const { d, calls } = deps({
      stripe: {
        createPaymentIntent: async (params, opts) => {
          calls.create.push([params, opts]);
          return { id: "pi_2", client_secret: "s", status: "requires_action", next_action: { boleto_display_details: { hosted_voucher_url: "https://payments.stripe.com/boleto/x", number: "123", expires_at: 1793700000 } } };
        },
      },
    });
    const r = await startCheckoutWith(d, checkoutInputSchema.parse({ ...input, method: "boleto" }));
    const [params] = calls.create[0] as [Record<string, unknown>];
    expect(params.confirm).toBe(true);
    expect(params.payment_method_data).toMatchObject({ type: "boleto", boleto: { tax_id: "52998224725" }, billing_details: { name: "Ana Souza", email: "ana@example.com" } });
    expect(params.payment_method_options).toEqual({ boleto: { expires_after_days: 3 } });
    expect(r).toEqual({ ok: true, kind: "boleto", orderNumber: 1001, totalMinor: 49980, boleto: { url: "https://payments.stripe.com/boleto/x", number: "123", expiresAt: new Date(1793700000 * 1000).toISOString() } });
    expect(calls.attach[0]).toEqual([ORDER, "pi_2", { url: "https://payments.stripe.com/boleto/x", number: "123", expiresAt: new Date(1793700000 * 1000).toISOString() }]);
  });
  it("tells the customer when the price changed before paying", async () => {
    const { d, calls } = deps({ createOrder: async () => { throw new Error("price_changed"); } });
    expect(await startCheckoutWith(d, checkoutInputSchema.parse({ ...input, expectedTotalMinor: 1 }))).toEqual({ ok: false, error: "O preço de um produto mudou. Confira o novo total antes de pagar.", priceChanged: true });
    expect(calls.create).toHaveLength(0);
  });
  it("passes the total the customer saw to the database", async () => {
    let seen: unknown;
    const { d } = deps({ createOrder: async (i) => ((seen = i.expectedTotalMinor), { orderId: ORDER, orderNumber: 1001, totalMinor: 49980 }) });
    await startCheckoutWith(d, checkoutInputSchema.parse({ ...input, expectedTotalMinor: 49980 }));
    expect(seen).toBe(49980);
  });
});
