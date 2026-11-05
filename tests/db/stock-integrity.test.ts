import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Client } from "pg";
import { createAdmin, createUser, makeProduct, serviceClient, uniq, type DB } from "./helpers";

let admin: { id: string; client: DB };
let buyer: { id: string; client: DB };
let rival: { id: string; client: DB };
let a: string;
let b: string;
let categoryId: string;
let savedModels: unknown;
let savedLegal: unknown;

const address = { recipientName: "Ana Souza", cpf: "52998224725", phone: "11987654321", cep: "01310100", street: "Av. Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP" };
const order = (c: DB, items: { productId: string; quantity: number }[], addr: unknown = address, method = "card") =>
  c.rpc("create_order_from_cart", { p_items: items as never, p_address: addr as never, p_method: method, p_save_address: false, p_expected_total: null as never });
const stockOf = async (id: string) => (await serviceClient().from("product_sale").select("stock_quantity").eq("product_id", id).single()).data!.stock_quantity;
const setStock = (id: string, stock_quantity: number) => serviceClient().from("product_sale").update({ stock_quantity }).eq("product_id", id);

async function stocked(name: string, quantity: number) {
  const p = await makeProduct({ name });
  const svc = serviceClient();
  await svc.from("products").update({ sale_mode: "own" }).eq("id", p.id);
  await svc.from("product_sale").upsert({ product_id: p.id, price_minor: 10000, available: true, fulfillment: "stock", stock_quantity: quantity });
  return p.id;
}

const savePayload = (id: string, slug: string, stockQuantity: number, stockRead?: number) => ({
  id,
  slug,
  categoryId,
  status: "published",
  featured: false,
  tags: [],
  specs: [],
  translations: { "pt-BR": { name: "Produto Salvo", shortDescription: "", descriptionMd: "", specs: [] } },
  images: [],
  offers: [],
  replaceOffers: true,
  saleMode: "own",
  sale: { priceMinor: 10000, compareAtMinor: null, pixDiscountPct: 0, available: true, deliveryMinDays: 3, deliveryMaxDays: 7, fulfillment: "stock", stockQuantity, ...(stockRead === undefined ? {} : { stockRead }) },
  suppliers: [],
});

beforeAll(async () => {
  const svc = serviceClient();
  savedModels = (await svc.from("site_settings").select("value").eq("key", "public.business_models").single()).data!.value;
  savedLegal = (await svc.from("site_settings").select("value").eq("key", "public.legal").single()).data!.value;
  await svc.from("site_settings").update({ value: { own_store: true, own_stock: true, dropshipping: true, affiliates: false, payments: { card: true, boleto: true, pix: false } } as never }).eq("key", "public.business_models");
  admin = await createAdmin("stock-admin@nextech.local", "admin");
  buyer = await createUser("stock-a@nextech.local");
  rival = await createUser("stock-b@nextech.local");
  a = await stocked("Produto A", 1000);
  b = await stocked("Produto B", 1000);
  const { data: cat } = await svc.from("categories").insert({ slug: uniq("cat-stock"), sort_order: 99 }).select("id").single();
  categoryId = cat!.id;
});

beforeEach(async () => {
  await serviceClient().from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("status", "awaiting_payment");
});

afterAll(async () => {
  const svc = serviceClient();
  await svc.from("site_settings").update({ value: savedModels as never }).eq("key", "public.business_models");
  await svc.from("site_settings").update({ value: savedLegal as never }).eq("key", "public.legal");
});

/** A plain connection, to hold a row lock while an RPC runs. The database port is the API port + 1. */
async function pgClient() {
  const c = new Client({ connectionString: `postgresql://postgres:postgres@127.0.0.1:${Number(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).port) + 1}/postgres` });
  await c.connect();
  return c;
}

describe("NXT-011: carts with the same products in opposite order", () => {
  it("lock products in a fixed order, whatever the cart order", async () => {
    await setStock(a, 1000);
    await setStock(b, 1000);
    const [first, second] = [a, b].sort();
    const holder = await pgClient();
    const probe = await pgClient();
    try {
      // hold the product that sorts second, then send a cart listing it first
      await holder.query("begin");
      await holder.query("select 1 from public.product_sale where product_id = $1 for update", [second]);
      const pendingOrder = Promise.resolve(order(buyer.client, [{ productId: second, quantity: 1 }, { productId: first, quantity: 1 }]));
      // with a fixed order the RPC took `first` and now waits on `second`; in cart order it would hold nothing yet
      await expect
        .poll(async () => (await probe.query("select 1 from public.product_sale where product_id = $1 for update skip locked", [first])).rowCount, { timeout: 5000 })
        .toBe(0);
      await holder.query("rollback");
      expect((await pendingOrder).error).toBeNull();
    } finally {
      await holder.query("rollback");
      await holder.end();
      await probe.end();
    }
  });
  it("never deadlock under concurrency", async () => {
    await setStock(a, 1000);
    await setStock(b, 1000);
    const users = await Promise.all(Array.from({ length: 10 }, (_, i) => createUser(`stock-dl-${i}@nextech.local`)));
    const results = await Promise.all(users.map((u, i) => order(u.client, i % 2 ? [{ productId: a, quantity: 1 }, { productId: b, quantity: 1 }] : [{ productId: b, quantity: 1 }, { productId: a, quantity: 1 }])));
    expect(results.filter((r) => r.error).map((r) => r.error!.message)).toEqual([]);
    expect(await stockOf(a)).toBe(990);
    expect(await stockOf(b)).toBe(990);
  });
});

describe("NXT-013: the RPC defends itself when called straight through the API", () => {
  it("refuses a junk address and takes no stock", async () => {
    await setStock(a, 5);
    for (const bad of [{}, { ...address, street: "x".repeat(200000) }, { ...address, cep: "abc" }, { ...address, state: "XX" }, { ...address, recipientName: "Ana" }]) {
      expect((await order(buyer.client, [{ productId: a, quantity: 1 }], bad)).error?.message).toBe("invalid_address");
    }
    expect(await stockOf(a)).toBe(5);
  });
  it("refuses to sell while the seller is not identified", async () => {
    const svc = serviceClient();
    await svc.from("site_settings").update({ value: { company_name: "", tax_id: "", address: "" } as never }).eq("key", "public.legal");
    const { error } = await order(buyer.client, [{ productId: a, quantity: 1 }]);
    await svc.from("site_settings").update({ value: savedLegal as never }).eq("key", "public.legal");
    expect(error?.message).toBe("store_closed");
  });
});

describe("NXT-005: holding stock without paying", () => {
  it("units in an expired hold are reported for sale; a hold still running and a boleto are not", async () => {
    await setStock(a, 3);
    const svc = serviceClient();
    const card = (await order(buyer.client, [{ productId: a, quantity: 1 }])).data![0].order_id;
    const boleto = (await order(buyer.client, [{ productId: a, quantity: 1 }], address, "boleto")).data![0].order_id;
    await order(buyer.client, [{ productId: a, quantity: 1 }]);
    const old = new Date(Date.now() - 31 * 60_000).toISOString();
    await svc.from("orders").update({ created_at: old }).in("id", [card, boleto]);
    const anon = buyer.client;
    expect((await anon.rpc("expired_hold_units", { p_ids: [a] })).data).toEqual([{ product_id: a, units: 1 }]);
  });
  it("one account can hold at most 10 units of a product", async () => {
    await setStock(a, 100);
    expect((await order(rival.client, [{ productId: a, quantity: 6 }])).error).toBeNull();
    expect((await order(rival.client, [{ productId: a, quantity: 4 }])).error).toBeNull();
    expect((await order(rival.client, [{ productId: a, quantity: 1 }])).error?.message).toBe("too_many_orders");
    expect(await stockOf(a)).toBe(90);
  });
  it("a card hold expires in 30 minutes; a dropship card order and a boleto keep their windows", async () => {
    await setStock(a, 10);
    const svc = serviceClient();
    const card = (await order(buyer.client, [{ productId: a, quantity: 1 }])).data![0].order_id;
    const boleto = (await order(buyer.client, [{ productId: a, quantity: 1 }], address, "boleto")).data![0].order_id;
    const age = (id: string, minutes: number) => svc.from("orders").update({ created_at: new Date(Date.now() - minutes * 60_000).toISOString() }).eq("id", id);
    const stale = async () => ((await svc.rpc("stale_unpaid_orders")).data ?? []).map((r) => r.order_id);
    await age(card, 29);
    expect(await stale()).not.toContain(card);
    await age(card, 31);
    await age(boleto, 31);
    const list = await stale();
    expect(list).toContain(card);
    expect(list).not.toContain(boleto);
    expect((await svc.rpc("order_cancel_unpaid", { p_order: card })).data).toBe(true);
    expect(await stockOf(a)).toBe(9);
  });
});

describe("NXT-006: saving a product with an old stock number", () => {
  const save = async (stock: number, read?: number) => {
    const { data: p } = await serviceClient().from("products").select("slug").eq("id", b).single();
    return admin.client.rpc("admin_save_product_stock_safe", { p: savePayload(b, p!.slug, stock, read) as never });
  };
  it("keeps the sales made while the form was open when the admin did not touch the field", async () => {
    await setStock(b, 5);
    await order(buyer.client, [{ productId: b, quantity: 3 }]);
    expect(await stockOf(b)).toBe(2);
    expect((await save(5, 5)).error).toBeNull();
    expect(await stockOf(b)).toBe(2);
  });
  it("refuses a typed stock based on a stale read instead of overwriting the sale", async () => {
    await setStock(b, 5);
    await order(buyer.client, [{ productId: b, quantity: 3 }]);
    expect((await save(8, 5)).error?.message).toBe("stock_changed");
    expect(await stockOf(b)).toBe(2);
  });
  it("applies a typed stock when nothing changed, and saving twice from one form is fine", async () => {
    await setStock(b, 5);
    expect((await save(8, 5)).error).toBeNull();
    expect(await stockOf(b)).toBe(8);
    expect((await save(8, 5)).error).toBeNull();
    expect(await stockOf(b)).toBe(8);
  });
  it("no unit is lost or created when sales and saves race", async () => {
    await setStock(b, 100);
    const users = await Promise.all(Array.from({ length: 12 }, (_, i) => createUser(`stock-race-${i}@nextech.local`)));
    const results = await Promise.all([
      ...users.map((u) => order(u.client, [{ productId: b, quantity: 1 }])),
      save(100, 100),
      save(100, 100),
      save(100, 100),
    ]);
    expect(results.filter((r) => r.error).map((r) => r.error!.message)).toEqual([]);
    expect(await stockOf(b)).toBe(88);
  });
  it("a caller that sends no read value (old code) behaves as before", async () => {
    await setStock(b, 5);
    expect((await save(7)).error).toBeNull();
    expect(await stockOf(b)).toBe(7);
    const { data: p } = await serviceClient().from("products").select("slug").eq("id", b).single();
    expect((await admin.client.rpc("admin_save_product_full", { p: savePayload(b, p!.slug, 9) as never })).error).toBeNull();
    expect(await stockOf(b)).toBe(9);
  });
  it("the wrapper leaves everything else to the real save, warranty included", async () => {
    await setStock(b, 5);
    const { data: p } = await serviceClient().from("products").select("slug").eq("id", b).single();
    const { error } = await admin.client.rpc("admin_save_product_stock_safe", { p: { ...savePayload(b, p!.slug, 5, 5), warranty: "12 meses" } as never });
    expect(error).toBeNull();
    expect((await serviceClient().from("products").select("warranty").eq("id", b).single()).data?.warranty).toBe("12 meses");
  });
});

describe("NXT-021: when stock goes back", () => {
  const paid = async (qty = 1) => {
    await setStock(a, 10);
    const id = (await order(buyer.client, [{ productId: a, quantity: qty }])).data![0].order_id;
    await serviceClient().from("orders").update({ status: "awaiting_supplier", paid_at: new Date().toISOString() }).eq("id", id);
    return id;
  };
  it("a full refund before shipping returns it", async () => {
    const id = await paid(2);
    const { error } = await serviceClient().rpc("order_record_refund", { p_order: id, p_pi: null as never, p_amount: 20000, p_method: "manual", p_stripe_refund: null as never, p_status: "succeeded", p_note: null as never, p_actor: null as never });
    expect(error).toBeNull();
    expect(await stockOf(a)).toBe(10);
  });
  it("cancelling an order already shipped does not", async () => {
    const id = await paid(2);
    const svc = serviceClient();
    await svc.from("orders").update({ status: "shipped" }).eq("id", id);
    await svc.from("orders").update({ status: "cancelled" }).eq("id", id);
    expect(await stockOf(a)).toBe(8);
  });
});
