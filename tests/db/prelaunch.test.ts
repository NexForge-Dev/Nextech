import { describe, it, expect, beforeAll } from "vitest";
import { anonClient, createUser, makeProduct, serviceClient, type DB } from "./helpers";

let productId: string;
const address = { recipientName: "Ana Souza", cpf: "52998224725", phone: "11987654321", cep: "01310100", street: "Av. Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP" };

async function order(client: DB, method = "card") {
  const { data, error } = await client.rpc("create_order_from_cart", { p_items: [{ productId, quantity: 1 }] as never, p_address: address as never, p_method: method } as never);
  if (error) throw error;
  return (data as { order_id: string }[])[0].order_id;
}

async function aged(id: string, days: number) {
  await serviceClient().from("orders").update({ created_at: new Date(Date.now() - days * 86_400_000).toISOString() }).eq("id", id);
}

beforeAll(async () => {
  const p = await makeProduct({ name: "Carregador Prelaunch" });
  productId = p.id;
  const svc = serviceClient();
  await svc.from("products").update({ sale_mode: "own" }).eq("id", p.id);
  await svc.from("product_sale").upsert({ product_id: p.id, price_minor: 12990 });
});

describe("order creation limit", () => {
  it("refuses an 11th unpaid order within an hour", async () => {
    const u = await createUser("prelaunch-spam@nextech.local");
    for (let i = 0; i < 10; i++) await order(u.client);
    await expect(order(u.client)).rejects.toMatchObject({ message: "too_many_orders" });
  });
});

describe("unpaid order expiry", () => {
  it("waits 7 days for a boleto (its payment can settle days after it expires) and 1 day for card/Pix", async () => {
    const u = await createUser("prelaunch-stale@nextech.local");
    const boleto6 = await order(u.client, "boleto");
    const boleto8 = await order(u.client, "boleto");
    const card2 = await order(u.client, "card");
    await aged(boleto6, 6);
    await aged(boleto8, 8);
    await aged(card2, 2);
    const { data, error } = await serviceClient().rpc("stale_unpaid_orders");
    expect(error).toBeNull();
    const ids = (data ?? []).map((r: { order_id: string }) => r.order_id);
    expect(ids).toContain(boleto8);
    expect(ids).toContain(card2);
    expect(ids).not.toContain(boleto6);
  });
  it("listing stale orders cancels nothing by itself", async () => {
    const u = await createUser("prelaunch-list@nextech.local");
    const o = await order(u.client, "card");
    await aged(o, 2);
    await serviceClient().rpc("stale_unpaid_orders");
    expect((await serviceClient().from("orders").select("status").eq("id", o).single()).data?.status).toBe("awaiting_payment");
  });
  it("cancels only an order that is still unpaid", async () => {
    const u = await createUser("prelaunch-cancel@nextech.local");
    const unpaid = await order(u.client, "card");
    const paid = await order(u.client, "card");
    const svc = serviceClient();
    await svc.from("orders").update({ status: "awaiting_supplier", paid_at: new Date().toISOString() }).eq("id", paid);
    expect((await svc.rpc("order_cancel_unpaid", { p_order: unpaid })).data).toBe(true);
    expect((await svc.rpc("order_cancel_unpaid", { p_order: unpaid })).data).toBe(false);
    expect((await svc.rpc("order_cancel_unpaid", { p_order: paid })).data).toBe(false);
    expect((await svc.from("orders").select("status").eq("id", paid).single()).data?.status).toBe("awaiting_supplier");
    const { data: ev } = await svc.from("order_events").select("kind, data").eq("order_id", unpaid).eq("kind", "cancelled");
    expect(ev).toHaveLength(1);
  });
  it("customers cannot call the expiry functions", async () => {
    const u = await createUser("prelaunch-rpc@nextech.local");
    expect((await u.client.rpc("stale_unpaid_orders")).error).not.toBeNull();
    expect((await anonClient().rpc("order_cancel_unpaid", { p_order: productId })).error).not.toBeNull();
  });
});

describe("own products without a price stay out of the storefront", () => {
  it("are left out of search and suggestions", async () => {
    const svc = serviceClient();
    const p = await makeProduct({ name: "Fonezinho Semprecozinho" });
    await svc.from("products").update({ sale_mode: "own" }).eq("id", p.id);
    const sb = anonClient();
    const { data: s } = await sb.rpc("search_products", { q: "Semprecozinho", p_locale: "pt-BR", p_market: "BR" });
    expect((s ?? []).map((r: { id: string }) => r.id)).not.toContain(p.id);
    const { data: g } = await sb.rpc("suggest", { q: "Semprecozinho", p_locale: "pt-BR" });
    expect((g ?? []).map((r: { slug: string }) => r.slug)).not.toContain(p.slug);
    await svc.from("product_sale").upsert({ product_id: p.id, price_minor: 9990 });
    const { data: g2 } = await sb.rpc("suggest", { q: "Semprecozinho", p_locale: "pt-BR" });
    expect((g2 ?? []).map((r: { slug: string }) => r.slug)).toContain(p.slug);
  });
});
