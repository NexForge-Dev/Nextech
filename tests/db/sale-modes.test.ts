import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createUser, makeProduct, serviceClient, type DB } from "./helpers";

let buyer: { id: string; client: DB };
let rival: { id: string; client: DB };
let stocked: { id: string; slug: string };
let dropship: { id: string; slug: string };
let savedModels: unknown;

const address = { recipientName: "Ana Souza", cpf: "52998224725", phone: "11987654321", cep: "01310100", street: "Av. Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP" };
const order = (c: DB, id: string, quantity = 1) =>
  c.rpc("create_order_from_cart", { p_items: [{ productId: id, quantity }] as never, p_address: address as never, p_method: "card", p_save_address: false, p_expected_total: null as never });

async function setModels(value: Record<string, unknown>) {
  await serviceClient().from("site_settings").update({ value: value as never }).eq("key", "public.business_models");
}
const models = (patch: Record<string, unknown> = {}) => ({ own_store: true, own_stock: true, dropshipping: true, affiliates: false, payments: { card: true, boleto: true, pix: false }, ...patch });
const stockOf = async (id: string) => (await serviceClient().from("product_sale").select("stock_quantity").eq("product_id", id).single()).data!.stock_quantity;

async function own(p: { id: string }, sale: Record<string, unknown>) {
  const svc = serviceClient();
  await svc.from("products").update({ sale_mode: "own" }).eq("id", p.id);
  await svc.from("product_sale").upsert({ product_id: p.id, price_minor: 10000, available: true, ...sale });
}

beforeAll(async () => {
  const svc = serviceClient();
  savedModels = (await svc.from("site_settings").select("value").eq("key", "public.business_models").single()).data!.value;
  buyer = await createUser("modes-a@nextech.local");
  rival = await createUser("modes-b@nextech.local");
  const s = await makeProduct({ name: "Produto Estoque" });
  const d = await makeProduct({ name: "Produto Dropship" });
  stocked = { id: s.id, slug: (await svc.from("products").select("slug").eq("id", s.id).single()).data!.slug };
  dropship = { id: d.id, slug: (await svc.from("products").select("slug").eq("id", d.id).single()).data!.slug };
  await own(dropship, { fulfillment: "dropship" });
  await own(stocked, { fulfillment: "stock", stock_quantity: 3 });
  await setModels(models());
});

afterEach(async () => {
  await setModels(models());
  await serviceClient().from("product_sale").update({ stock_quantity: 3 }).eq("product_id", stocked.id);
});

afterAll(async () => {
  await serviceClient().from("site_settings").update({ value: savedModels as never }).eq("key", "public.business_models");
});

describe("own stock", () => {
  it("takes the units when the order is created", async () => {
    const { error } = await order(buyer.client, stocked.id, 2);
    expect(error).toBeNull();
    expect(await stockOf(stocked.id)).toBe(1);
  });
  it("refuses more than what is left and keeps the stock", async () => {
    const { error } = await order(buyer.client, stocked.id, 4);
    expect(error?.message).toBe(`item_unavailable:${stocked.slug}`);
    expect(await stockOf(stocked.id)).toBe(3);
  });
  it("sells the last unit to only one of two simultaneous buyers", async () => {
    await serviceClient().from("product_sale").update({ stock_quantity: 1 }).eq("product_id", stocked.id);
    const results = await Promise.all([order(buyer.client, stocked.id), order(rival.client, stocked.id)]);
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(await stockOf(stocked.id)).toBe(0);
  });
  it("returns the units once when the order is cancelled, whatever comes after", async () => {
    const { data } = await order(buyer.client, stocked.id, 2);
    const svc = serviceClient();
    const id = data![0].order_id;
    await svc.from("orders").update({ status: "cancelled" }).eq("id", id);
    expect(await stockOf(stocked.id)).toBe(3);
    await svc.from("orders").update({ status: "refunded" }).eq("id", id);
    await svc.from("orders").update({ status: "cancelled" }).eq("id", id);
    expect(await stockOf(stocked.id)).toBe(3);
  });
  it("leaves dropshipping products out of the stock count", async () => {
    const { error } = await order(buyer.client, dropship.id, 5);
    expect(error).toBeNull();
    const { data } = await serviceClient().from("product_sale").select("stock_quantity").eq("product_id", dropship.id).single();
    expect(data!.stock_quantity).toBeNull();
  });
  it("needs a quantity", async () => {
    const { error } = await serviceClient().from("product_sale").update({ stock_quantity: null }).eq("product_id", stocked.id);
    expect(error?.message).toContain("product_sale_stock_needs_quantity");
  });
});

describe("each mode has its own switch", () => {
  const listed = async (id: string) => {
    const { data } = await serviceClient().rpc("search_products", { q: "", p_locale: "pt-BR", p_market: "BR", p_limit: 100, p_offset: 0 });
    return (data ?? []).some((r) => r.id === id);
  };
  it("shows both with both on", async () => {
    expect(await listed(stocked.id)).toBe(true);
    expect(await listed(dropship.id)).toBe(true);
  });
  it("hides and refuses dropshipping alone", async () => {
    await setModels(models({ dropshipping: false }));
    expect(await listed(dropship.id)).toBe(false);
    expect(await listed(stocked.id)).toBe(true);
    expect((await order(buyer.client, dropship.id)).error?.message).toBe(`item_unavailable:${dropship.slug}`);
    expect((await order(buyer.client, stocked.id)).error).toBeNull();
  });
  it("hides and refuses own stock alone", async () => {
    await setModels(models({ own_stock: false }));
    expect(await listed(stocked.id)).toBe(false);
    expect(await listed(dropship.id)).toBe(true);
    expect((await order(buyer.client, stocked.id)).error?.message).toBe(`item_unavailable:${stocked.slug}`);
  });
  it("treats settings saved before this change as dropshipping", async () => {
    await setModels({ own_store: true, affiliates: false, payments: { card: true, boleto: true, pix: false } });
    expect(await listed(dropship.id)).toBe(true);
    expect(await listed(stocked.id)).toBe(false);
  });
});
