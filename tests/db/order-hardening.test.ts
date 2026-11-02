import { describe, it, expect, beforeAll } from "vitest";
import { createUser, makeProduct, serviceClient, type DB } from "./helpers";

let a: { id: string; client: DB };
let productId: string;
const address = { recipientName: "Ana Souza", cpf: "52998224725", phone: "11987654321", cep: "01310100", street: "Av. Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP" };

async function newOrder(method = "card", expected?: number) {
  const { data, error } = await a.client.rpc("create_order_from_cart", {
    p_items: [{ productId, quantity: 1 }] as never,
    p_address: address as never,
    p_method: method,
    ...(expected != null ? { p_expected_total: expected } : {}),
  } as never);
  if (error) throw error;
  const row = (data as { order_id: string; order_number: number }[])[0];
  return { id: row.order_id, number: Number(row.order_number) };
}

beforeAll(async () => {
  a = await createUser("hardening-a@nextech.local");
  const p = await makeProduct({ name: "Fone Endurecido" });
  productId = p.id;
  const svc = serviceClient();
  await svc.from("products").update({ sale_mode: "own" }).eq("id", p.id);
  await svc.from("product_sale").upsert({ product_id: p.id, price_minor: 24990 });
});

describe("customer views are read-only", () => {
  it("a customer cannot mark their own order paid through my_orders", async () => {
    const o = await newOrder();
    await a.client.from("my_orders").update({ status: "awaiting_supplier", paid_at: new Date().toISOString() } as never).eq("id", o.id);
    const { data } = await serviceClient().from("orders").select("status, paid_at").eq("id", o.id).single();
    expect(data).toEqual({ status: "awaiting_payment", paid_at: null });
  });
  it("a customer cannot delete their own order through my_orders", async () => {
    const o = await newOrder();
    await a.client.from("my_orders").delete().eq("id", o.id);
    expect((await serviceClient().from("orders").select("id").eq("id", o.id)).data).toHaveLength(1);
  });
});

describe("checkout price guard", () => {
  it("refuses when the price changed since the customer saw it", async () => {
    await expect(newOrder("card", 19990)).rejects.toMatchObject({ message: "price_changed" });
    expect((await newOrder("card", 24990)).number).toBeGreaterThan(0);
  });
});

describe("locked admin transitions", () => {
  it("cannot register a supplier purchase on a cancelled order", async () => {
    const o = await newOrder();
    const svc = serviceClient();
    await svc.from("orders").update({ status: "cancelled" }).eq("id", o.id);
    const { data: item } = await svc.from("order_items").select("id").eq("order_id", o.id).single();
    const { error } = await svc.rpc("admin_update_order_item", { p_item: item!.id, p_patch: { purchased: true, supplierCostMinor: 100 } as never, p_actor: null as never });
    expect(error?.message).toBe("order_closed");
    expect((await svc.from("orders").select("status").eq("id", o.id).single()).data?.status).toBe("cancelled");
  });
  it("the first purchase moves a paid order forward in the same transaction", async () => {
    const o = await newOrder();
    const svc = serviceClient();
    await svc.from("orders").update({ status: "awaiting_supplier", paid_at: new Date().toISOString() }).eq("id", o.id);
    const { data: item } = await svc.from("order_items").select("id").eq("order_id", o.id).single();
    const { data } = await svc.rpc("admin_update_order_item", { p_item: item!.id, p_patch: { purchased: true, supplierCostMinor: 15890 } as never, p_actor: null as never });
    expect(data).toBe("supplier_purchased");
  });
  it("a status change based on a stale read is refused", async () => {
    const o = await newOrder();
    const svc = serviceClient();
    await svc.from("orders").update({ status: "supplier_purchased" }).eq("id", o.id);
    const { error } = await svc.rpc("admin_set_order_status", { p_order: o.id, p_expected: "awaiting_supplier", p_to: "shipped", p_actor: null as never, p_data: {} as never });
    expect(error?.message).toBe("status_changed");
  });
  it("a cancelled order cannot be reopened", async () => {
    const o = await newOrder();
    const svc = serviceClient();
    await svc.from("orders").update({ status: "cancelled" }).eq("id", o.id);
    const { error } = await svc.rpc("admin_set_order_status", { p_order: o.id, p_expected: "cancelled", p_to: "shipped", p_actor: null as never, p_data: {} as never });
    expect(error?.message).toBe("order_closed");
  });
});

describe("payments and webhook bookkeeping", () => {
  it("reports a payment that succeeds on a cancelled order", async () => {
    const o = await newOrder();
    const svc = serviceClient();
    await svc.from("orders").update({ status: "cancelled", stripe_payment_intent_id: `pi_c_${o.id}` }).eq("id", o.id);
    const { data } = await svc.rpc("order_mark_paid", { p_pi: `pi_c_${o.id}`, p_order: o.id, p_fee: 100, p_summary: "x" });
    expect(data?.[0]).toMatchObject({ transitioned: false, was_cancelled: true });
  });
  it("re-claims an event whose processing never finished", async () => {
    const svc = serviceClient();
    const id = `evt_${Date.now()}`;
    expect((await svc.rpc("claim_stripe_event", { p_id: id, p_type: "x" })).data).toBe(true);
    expect((await svc.rpc("claim_stripe_event", { p_id: id, p_type: "x" })).data).toBe(false);
    await svc.from("stripe_events").update({ received_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("id", id);
    expect((await svc.rpc("claim_stripe_event", { p_id: id, p_type: "x" })).data).toBe(true);
    await svc.from("stripe_events").update({ processed_at: new Date().toISOString() }).eq("id", id);
    await svc.from("stripe_events").update({ received_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("id", id);
    expect((await svc.rpc("claim_stripe_event", { p_id: id, p_type: "x" })).data).toBe(false);
  });
  it("cancels abandoned unpaid orders", async () => {
    const o = await newOrder("boleto");
    const svc = serviceClient();
    await svc.from("orders").update({ created_at: new Date(Date.now() - 6 * 86_400_000).toISOString(), stripe_payment_intent_id: `pi_s_${o.id}` }).eq("id", o.id);
    const { data } = await svc.rpc("cancel_stale_orders");
    expect((data ?? []).map((r: { order_id: string }) => r.order_id)).toContain(o.id);
    expect((await svc.from("orders").select("status").eq("id", o.id).single()).data?.status).toBe("cancelled");
  });
});
