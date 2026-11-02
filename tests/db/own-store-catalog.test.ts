import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { anonClient, makeProduct, serviceClient } from "./helpers";

let published: { id: string };
let draft: { id: string };

async function setModels(v: { own_store: boolean; affiliates: boolean }) {
  await serviceClient()
    .from("site_settings")
    .upsert({ key: "public.business_models", value: { ...v, payments: { card: true, boleto: true, pix: false } } });
}

beforeAll(async () => {
  published = await makeProduct({ name: "Produto venda própria" });
  draft = await makeProduct({ name: "Rascunho venda própria", status: "draft" });
  const svc = serviceClient();
  await svc.from("products").update({ sale_mode: "own" }).in("id", [published.id, draft.id]);
  await svc.from("product_sale").insert([
    { product_id: published.id, price_minor: 24990 },
    { product_id: draft.id, price_minor: 9990 },
  ]);
  const { data: sup } = await svc.from("suppliers").select("id").eq("slug", "amazon-br").single();
  await svc.from("product_suppliers").insert({ product_id: published.id, supplier_id: sup!.id, url: "https://www.amazon.com.br/dp/X", cost_minor: 16500, is_primary: true });
});

afterAll(async () => setModels({ own_store: true, affiliates: false }));

describe("own store catalog", () => {
  it("anon reads sale data of a published product", async () => {
    const { data } = await anonClient().from("product_sale").select("price_minor").eq("product_id", published.id);
    expect(data).toEqual([{ price_minor: 24990 }]);
  });
  it("anon cannot read sale data of a draft", async () => {
    const { data } = await anonClient().from("product_sale").select("price_minor").eq("product_id", draft.id);
    expect(data).toEqual([]);
  });
  it("anon never reads suppliers or product suppliers", async () => {
    const a = anonClient();
    expect((await a.from("product_suppliers").select("*").eq("product_id", published.id)).data).toEqual([]);
    expect((await a.from("suppliers").select("*")).data).toEqual([]);
  });
  it("affiliates are off and own store is on by default", async () => {
    const a = anonClient();
    expect((await a.rpc("business_model_enabled", { p_mode: "affiliate" })).data).toBe(false);
    expect((await a.rpc("business_model_enabled", { p_mode: "own" })).data).toBe(true);
  });
  it("product visibility follows the sale mode switch", async () => {
    const a = anonClient();
    expect((await a.rpc("product_mode_enabled", { p: published.id })).data).toBe(true);
    await setModels({ own_store: false, affiliates: true });
    expect((await a.rpc("product_mode_enabled", { p: published.id })).data).toBe(false);
    await setModels({ own_store: true, affiliates: false });
  });
  it("only one primary supplier per product", async () => {
    const svc = serviceClient();
    const { data: sup } = await svc.from("suppliers").select("id").eq("slug", "mercado-livre").single();
    const { error } = await svc.from("product_suppliers").insert({ product_id: published.id, supplier_id: sup!.id, is_primary: true });
    expect(error).not.toBeNull();
  });
});
