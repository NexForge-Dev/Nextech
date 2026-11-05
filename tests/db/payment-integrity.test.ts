import { describe, it, expect, beforeAll } from "vitest";
import { createUser, makeProduct, serviceClient, type DB } from "./helpers";

let a: { id: string; client: DB };
let productId: string;
const address = { recipientName: "Ana Souza", cpf: "52998224725", phone: "11987654321", cep: "01310100", street: "Av. Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP" };

async function newOrder() {
  const { data, error } = await a.client.rpc("create_order_from_cart", { p_items: [{ productId, quantity: 1 }] as never, p_address: address as never, p_method: "card", p_save_address: false, p_expected_total: null as never });
  if (error) throw error;
  return data![0].order_id;
}
const orderOf = async (id: string) => (await serviceClient().from("orders").select("status, paid_at, refunded_minor").eq("id", id).single()).data!;
/** Real orders always have these, and their data.to is "customer" or "owner", not a status. */
const emails = (id: string) => serviceClient().from("order_events").insert([{ order_id: id, actor: "system", kind: "email_sent", data: { template: "orderConfirmed", to: "customer" } }, { order_id: id, actor: "system", kind: "email_skipped", data: { template: "ownerNewOrder", to: "owner" } }]);
const refund = (id: string, stripeId: string, status: string) =>
  serviceClient().rpc("order_record_refund", { p_order: id, p_pi: null as never, p_amount: 24990, p_method: "stripe", p_stripe_refund: stripeId, p_status: status, p_note: null as never, p_actor: null as never });

beforeAll(async () => {
  a = await createUser("payment-integrity@nextech.local");
  const p = await makeProduct({ name: "Fone Integro" });
  productId = p.id;
  const svc = serviceClient();
  await svc.from("products").update({ sale_mode: "own" }).eq("id", p.id);
  await svc.from("product_sale").upsert({ product_id: p.id, price_minor: 24990 });
});

describe("NXT-003: an unpaid order", () => {
  it("cannot be moved forward by the admin, only cancelled", async () => {
    const id = await newOrder();
    const svc = serviceClient();
    for (const to of ["awaiting_supplier", "supplier_purchased", "shipped", "delivered"]) {
      const { error } = await svc.rpc("admin_set_order_status", { p_order: id, p_expected: "awaiting_payment", p_to: to, p_actor: null as never, p_data: {} as never });
      expect(error?.message).toBe("order_unpaid");
    }
    expect((await orderOf(id)).status).toBe("awaiting_payment");
    const { error } = await svc.rpc("admin_set_order_status", { p_order: id, p_expected: "awaiting_payment", p_to: "cancelled", p_actor: null as never, p_data: {} as never });
    expect(error).toBeNull();
  });
  it("a payment on an order moved by older code is still recorded, so it can be refunded", async () => {
    const id = await newOrder();
    const svc = serviceClient();
    await svc.from("orders").update({ status: "supplier_purchased" }).eq("id", id);
    await svc.rpc("order_mark_paid", { p_pi: `pi_${id}`, p_order: id, p_fee: 100, p_summary: "Cartão" as never });
    expect((await orderOf(id)).paid_at).not.toBeNull();
    const { data } = await svc.from("order_events").select("kind").eq("order_id", id);
    expect(data!.map((e) => e.kind)).toContain("paid");
  });
});

describe("a refund's status only moves forward", () => {
  const paid = async () => {
    const id = await newOrder();
    await serviceClient().from("orders").update({ status: "awaiting_supplier", paid_at: new Date().toISOString() }).eq("id", id);
    await emails(id);
    return id;
  };
  const statusOf = async (sid: string) => (await serviceClient().from("order_refunds").select("status").eq("stripe_refund_id", sid).single()).data?.status;
  it("a late pending after succeeded changes nothing, on an ordinary order", async () => {
    const id = await paid();
    await refund(id, `re_o1_${id}`, "succeeded");
    expect((await refund(id, `re_o1_${id}`, "pending")).error).toBeNull();
    expect(await statusOf(`re_o1_${id}`)).toBe("succeeded");
    expect(await orderOf(id)).toMatchObject({ status: "refunded", refunded_minor: 24990 });
  });
  it("a late pending after succeeded changes nothing, on a cancelled order", async () => {
    const id = await newOrder();
    await serviceClient().from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString(), paid_at: new Date().toISOString() }).eq("id", id);
    await refund(id, `re_o2_${id}`, "succeeded");
    await refund(id, `re_o2_${id}`, "pending");
    expect(await orderOf(id)).toMatchObject({ status: "refunded", refunded_minor: 24990 });
  });
  it("a late succeeded cannot revive a failed refund", async () => {
    const id = await paid();
    await refund(id, `re_o3_${id}`, "succeeded");
    await refund(id, `re_o3_${id}`, "failed");
    expect((await refund(id, `re_o3_${id}`, "succeeded")).error).toBeNull();
    expect(await statusOf(`re_o3_${id}`)).toBe("failed");
    expect(await orderOf(id)).toMatchObject({ status: "awaiting_supplier", refunded_minor: 0 });
  });
  it("every order of events ends in the same place, and duplicates are no-ops", async () => {
    const ends: string[] = [];
    for (const seq of [["pending", "succeeded", "failed"], ["failed", "succeeded", "pending"], ["succeeded", "failed", "pending"], ["pending", "pending", "failed", "failed"]]) {
      const id = await paid();
      for (const s of seq) expect((await refund(id, `re_seq_${id}`, s)).error).toBeNull();
      ends.push(`${await statusOf(`re_seq_${id}`)}:${(await orderOf(id)).status}`);
    }
    expect(new Set(ends)).toEqual(new Set(["failed:awaiting_supplier"]));
  });
});

describe("NXT-009: refund statuses", () => {
  it("an unknown status is stored as pending, not a constraint violation", async () => {
    const id = await newOrder();
    await serviceClient().from("orders").update({ status: "awaiting_supplier", paid_at: new Date().toISOString() }).eq("id", id);
    expect((await refund(id, `re_action_${id}`, "requires_action")).error).toBeNull();
    const { data } = await serviceClient().from("order_refunds").select("status").eq("order_id", id).single();
    expect(data!.status).toBe("pending");
  });
});

describe("NXT-010: a refund that fails after it was confirmed", () => {
  it("reopens an order with e-mail events, whose `to` is not a status, without a constraint error", async () => {
    const id = await newOrder();
    const svc = serviceClient();
    await svc.from("orders").update({ status: "awaiting_supplier", paid_at: new Date().toISOString() }).eq("id", id);
    await emails(id);
    await refund(id, `re_mail_${id}`, "succeeded");
    expect((await refund(id, `re_mail_${id}`, "failed")).error).toBeNull();
    expect(await orderOf(id)).toMatchObject({ status: "awaiting_supplier", refunded_minor: 0 });
  });
  it("reopens the order where it was", async () => {
    const id = await newOrder();
    const svc = serviceClient();
    await svc.from("orders").update({ status: "awaiting_supplier", paid_at: new Date().toISOString() }).eq("id", id);
    await svc.rpc("admin_set_order_status", { p_order: id, p_expected: "awaiting_supplier", p_to: "supplier_purchased", p_actor: null as never, p_data: {} as never });
    await emails(id);
    await refund(id, `re_late_${id}`, "succeeded");
    expect(await orderOf(id)).toMatchObject({ status: "refunded", refunded_minor: 24990 });
    await refund(id, `re_late_${id}`, "failed");
    expect(await orderOf(id)).toMatchObject({ status: "supplier_purchased", refunded_minor: 0 });
    const { data } = await svc.from("order_events").select("kind").eq("order_id", id);
    expect(data!.map((e) => e.kind)).toContain("refund_reverted");
  });
  it("a cancelled order goes back to cancelled, still owing the money", async () => {
    const id = await newOrder();
    const svc = serviceClient();
    await svc.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString(), paid_at: new Date().toISOString() }).eq("id", id);
    await refund(id, `re_c_${id}`, "succeeded");
    await refund(id, `re_c_${id}`, "failed");
    expect(await orderOf(id)).toMatchObject({ status: "cancelled", refunded_minor: 0 });
  });
  it("a refund seen before the payment event does not leave paid_at empty", async () => {
    const id = await newOrder();
    const svc = serviceClient();
    await refund(id, `re_o_${id}`, "succeeded");
    expect((await orderOf(id)).status).toBe("refunded");
    await svc.rpc("order_mark_paid", { p_pi: `pi_o_${id}`, p_order: id, p_fee: 100, p_summary: null as never });
    expect((await orderOf(id)).paid_at).not.toBeNull();
  });
});
