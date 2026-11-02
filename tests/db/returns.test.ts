import { describe, it, expect, beforeAll } from "vitest";
import { createUser, makeProduct, serviceClient, type DB } from "./helpers";

let a: { id: string; client: DB };
let b: { id: string; client: DB };
let productId: string;

const address = { recipientName: "Ana Souza", cpf: "52998224725", phone: "11987654321", cep: "01310100", street: "Av. Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP" };

async function paidOrder(c: DB): Promise<{ id: string; number: number }> {
  const { data, error } = await c.rpc("create_order_from_cart", { p_items: [{ productId, quantity: 1 }] as never, p_address: address as never, p_method: "card" });
  if (error) throw error;
  const id = data![0].order_id;
  await serviceClient().from("orders").update({ status: "awaiting_supplier", paid_at: new Date().toISOString() }).eq("id", id);
  return { id, number: Number(data![0].order_number) };
}

beforeAll(async () => {
  a = await createUser("returns-a@nextech.local");
  b = await createUser("returns-b@nextech.local");
  const p = await makeProduct({ name: "Fone Devolução" });
  productId = p.id;
  const svc = serviceClient();
  await svc.from("products").update({ sale_mode: "own" }).eq("id", p.id);
  await svc.from("product_sale").upsert({ product_id: p.id, price_minor: 24990 });
});

describe("customer_cancel_order", () => {
  it("cancels before the supplier purchase", async () => {
    const o = await paidOrder(a.client);
    const { data, error } = await a.client.rpc("customer_cancel_order", { p_number: o.number });
    expect(error).toBeNull();
    expect(data?.[0]).toMatchObject({ previous_status: "awaiting_supplier", payment_method: "card" });
    expect((await serviceClient().from("orders").select("status").eq("id", o.id).single()).data?.status).toBe("cancelled");
  });
  it("refuses once any item was bought at a supplier", async () => {
    const o = await paidOrder(a.client);
    await serviceClient().from("order_items").update({ supplier_purchased_at: new Date().toISOString() }).eq("order_id", o.id);
    const { error } = await a.client.rpc("customer_cancel_order", { p_number: o.number });
    expect(error?.message).toBe("already_purchased");
  });
  it("cannot cancel someone else's order", async () => {
    const o = await paidOrder(a.client);
    const { error } = await b.client.rpc("customer_cancel_order", { p_number: o.number });
    expect(error?.message).toBe("order_not_found");
  });
});

describe("return requests", () => {
  it("creates a request with photos from the customer's own folder only", async () => {
    const o = await paidOrder(a.client);
    const bad = await a.client.rpc("create_return_request", { p_number: o.number, p_reason: "defect", p_message: "Parou de carregar", p_photos: [`${b.id}/x.jpg`] });
    expect(bad.error?.message).toBe("invalid_photo");
    const ok = await a.client.rpc("create_return_request", { p_number: o.number, p_reason: "defect", p_message: "Parou de carregar", p_photos: [`${a.id}/x.jpg`] });
    expect(ok.error).toBeNull();
    const again = await a.client.rpc("create_return_request", { p_number: o.number, p_reason: "other", p_message: "Outra coisa", p_photos: [] });
    expect(again.error?.message).toBe("already_open");
  });
  it("a customer cannot resolve their own request", async () => {
    const { data } = await a.client.from("return_requests").select("id").limit(1);
    const { data: updated } = await a.client.from("return_requests").update({ status: "resolved", outcome: "refund_full" }).eq("id", data![0].id).select("id");
    expect(updated ?? []).toEqual([]);
  });
  it("return photos are private to their owner", async () => {
    const path = `${a.id}/prova-${Date.now()}.png`;
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    expect((await a.client.storage.from("returns").upload(path, png, { contentType: "image/png" })).error).toBeNull();
    expect((await b.client.storage.from("returns").download(path)).error).not.toBeNull();
    expect((await b.client.storage.from("returns").upload(`${a.id}/intruso.png`, png, { contentType: "image/png" })).error).not.toBeNull();
  });
});
