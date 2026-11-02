import { describe, it, expect, beforeAll } from "vitest";
import { anonClient, createUser, makeProduct, serviceClient, type DB } from "./helpers";

// 0025: internal definer helpers are not part of the public API; refunded orders get no returns.

describe("internal SECURITY DEFINER helpers", () => {
  it("cannot be called by anon or signed-in customers", async () => {
    const p = await makeProduct({ name: "Helper Probe" });
    const u = await createUser("audit-helpers@nextech.local");
    for (const c of [anonClient(), u.client]) {
      expect((await c.rpc("refresh_product_search" as never, { p_product: p.id } as never)).error?.code).toBe("42501");
      expect((await c.rpc("product_popularity" as never, { p_product: p.id } as never)).error?.code).toBe("42501");
      expect((await c.rpc("offer_display_price" as never, { p_link: p.id } as never)).error?.code).toBe("42501");
      expect((await c.rpc("offer_proven_previous" as never, { p_link: p.id } as never)).error?.code).toBe("42501");
    }
  });
  it("search still works for anon (the helpers run inside definer functions)", async () => {
    const { error } = await anonClient().rpc("search_products", { q: "", p_locale: "pt-BR", p_market: "BR" });
    expect(error).toBeNull();
  });
  it("product_market_price returns nothing for a draft product", async () => {
    const p = await makeProduct({ name: "Draft Price", status: "draft" });
    const { data, error } = await anonClient().rpc("product_market_price", { p_product: p.id, p_market: "BR" });
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});

describe("return requests on refunded orders", () => {
  let a: { id: string; client: DB };
  let productId: string;
  beforeAll(async () => {
    a = await createUser("audit-returns@nextech.local");
    const p = await makeProduct({ name: "Fone Reembolsado" });
    productId = p.id;
    const svc = serviceClient();
    await svc.from("products").update({ sale_mode: "own" }).eq("id", p.id);
    await svc.from("product_sale").upsert({ product_id: p.id, price_minor: 19990 });
  });
  it("are refused", async () => {
    const address = { recipientName: "Ana Souza", cpf: "52998224725", phone: "11987654321", cep: "01310100", street: "Av. Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP" };
    const { data, error } = await a.client.rpc("create_order_from_cart", { p_items: [{ productId, quantity: 1 }] as never, p_address: address as never, p_method: "card" });
    expect(error).toBeNull();
    const id = data![0].order_id;
    await serviceClient().from("orders").update({ status: "refunded", paid_at: new Date().toISOString(), refunded_minor: 19990 }).eq("id", id);
    const r = await a.client.rpc("create_return_request", { p_number: Number(data![0].order_number), p_reason: "defect", p_message: "Parou de funcionar", p_photos: [] });
    expect(r.error?.message).toBe("not_returnable");
  });
});
