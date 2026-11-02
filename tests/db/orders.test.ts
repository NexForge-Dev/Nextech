import { describe, it, expect, beforeAll } from "vitest";
import { createUser, makeProduct, serviceClient, type DB } from "./helpers";

let a: { id: string; client: DB };
let b: { id: string; client: DB };
let fone: { id: string; slug: string };
let esgotado: { id: string; slug: string };
let barato: { id: string };

const address = { recipientName: "Ana Souza", cpf: "52998224725", phone: "11987654321", cep: "01310100", street: "Av. Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP" };

async function own(p: { id: string }, priceMinor: number, available = true) {
  const svc = serviceClient();
  await svc.from("products").update({ sale_mode: "own" }).eq("id", p.id);
  await svc.from("product_sale").upsert({ product_id: p.id, price_minor: priceMinor, available, pix_discount_pct: 5 });
}

const order = (c: DB, items: unknown, method = "card") => c.rpc("create_order_from_cart", { p_items: items as never, p_address: address as never, p_method: method });

beforeAll(async () => {
  a = await createUser("orders-a@nextech.local");
  b = await createUser("orders-b@nextech.local");
  const f = await makeProduct({ name: "Fone Pedido" });
  const e = await makeProduct({ name: "Fone Pedido Esgotado" });
  barato = await makeProduct({ name: "Cabo Pedido Barato" });
  const svc = serviceClient();
  fone = { id: f.id, slug: (await svc.from("products").select("slug").eq("id", f.id).single()).data!.slug };
  esgotado = { id: e.id, slug: (await svc.from("products").select("slug").eq("id", e.id).single()).data!.slug };
  await own(fone, 24990);
  await own(esgotado, 9990, false);
  await own(barato, 400);
});

describe("create_order_from_cart", () => {
  it("rejects an empty cart", async () => {
    const { error } = await order(a.client, []);
    expect(error?.message).toBe("cart_empty");
  });
  it("rejects a sold-out item by slug", async () => {
    const { error } = await order(a.client, [{ productId: esgotado.id, quantity: 1 }]);
    expect(error?.message).toBe(`item_unavailable:${esgotado.slug}`);
  });
  it("prices from the database and ignores client prices", async () => {
    const { data, error } = await order(a.client, [{ productId: fone.id, quantity: 2, priceMinor: 1 }]);
    expect(error).toBeNull();
    expect(data?.[0].total_minor).toBe(49980);
  });
  it("uses the current price after the product price changed", async () => {
    await serviceClient().from("product_sale").update({ price_minor: 19990 }).eq("product_id", fone.id);
    const { data } = await order(a.client, [{ productId: fone.id, quantity: 1 }]);
    await serviceClient().from("product_sale").update({ price_minor: 24990 }).eq("product_id", fone.id);
    expect(data?.[0].total_minor).toBe(19990);
  });
  it("refuses boleto below R$5,00", async () => {
    const { error } = await order(a.client, [{ productId: barato.id, quantity: 1 }], "boleto");
    expect(error?.message).toBe("amount_out_of_range");
  });
  it("refuses Pix while it is switched off", async () => {
    const { error } = await order(a.client, [{ productId: fone.id, quantity: 1 }], "pix");
    expect(error?.message).toBe("method_disabled");
  });
  it("applies the Pix discount when Pix is on", async () => {
    const svc = serviceClient();
    await svc.from("site_settings").upsert({ key: "public.business_models", value: { own_store: true, affiliates: false, payments: { card: true, boleto: true, pix: true } } });
    const { data } = await order(a.client, [{ productId: fone.id, quantity: 1 }], "pix");
    await svc.from("site_settings").upsert({ key: "public.business_models", value: { own_store: true, affiliates: false, payments: { card: true, boleto: true, pix: false } } });
    expect(data?.[0].total_minor).toBe(23741);
  });
});

describe("order privacy", () => {
  it("a customer sees only their own orders, and never internal columns", async () => {
    const { data: created } = await order(a.client, [{ productId: fone.id, quantity: 1 }]);
    const id = created![0].order_id;
    expect((await b.client.from("my_orders").select("id").eq("id", id)).data).toEqual([]);
    expect((await a.client.from("my_orders").select("id, number").eq("id", id)).data).toHaveLength(1);
    const direct = await a.client.from("orders").select("stripe_fee_minor").eq("id", id);
    expect(direct.data ?? []).toEqual([]);
    const items = await a.client.from("my_order_items").select("*").eq("order_id", id);
    expect(items.data?.[0]).not.toHaveProperty("supplier_cost_minor");
    expect(items.data?.[0]).toMatchObject({ unit_price_minor: 24990, quantity: 1 });
  });
  it("anonymous visitors cannot create orders", async () => {
    const { anonClient } = await import("./helpers");
    const { error } = await order(anonClient(), [{ productId: fone.id, quantity: 1 }]);
    expect(error).not.toBeNull();
  });
});
