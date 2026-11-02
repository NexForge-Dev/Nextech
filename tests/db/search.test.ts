import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { anonClient, makeProduct, serviceClient } from "./helpers";

const models = (affiliates: boolean) =>
  serviceClient().from("site_settings").upsert({ key: "public.business_models", value: { own_store: true, affiliates, payments: { card: true, boleto: true, pix: false } } });

const base = {
  p_locale: "pt-BR",
  p_market: "BR",
  p_category: undefined,
  p_brand: undefined,
  p_store: undefined,
  p_min_minor: undefined,
  p_max_minor: undefined,
  p_min_rating: undefined,
  p_proven_discount: false,
  p_sort: "relevance",
  p_limit: 24,
  p_offset: 0,
};

let own: { id: string };

beforeAll(async () => {
  await models(true);
  await makeProduct({ name: "Café Expresso Máquina" });
  await makeProduct({ name: "Café Rascunho Secreto", status: "draft" });
  own = await makeProduct({ name: "Fone Própria Zumbido" });
  const svc = serviceClient();
  await svc.from("products").update({ sale_mode: "own" }).eq("id", own.id);
  await svc.from("product_sale").insert({ product_id: own.id, price_minor: 24990, compare_at_minor: 29990 });
});

afterAll(async () => {
  await models(false);
});

describe("search_products — business models", () => {
  it("prices own products from product_sale in Brazil", async () => {
    const { data } = await anonClient().rpc("search_products", { ...base, q: "zumbido" });
    expect(data?.map((r) => [r.name, r.best_price_minor, r.discount])).toEqual([["Fone Própria Zumbido", 24990, 17]]);
  });
  it("hides own products outside Brazil", async () => {
    const { data } = await anonClient().rpc("search_products", { ...base, p_market: "PT", q: "zumbido" });
    expect(data).toEqual([]);
  });
  it("hides affiliate products while affiliates are off", async () => {
    await models(false);
    const { data } = await anonClient().rpc("search_products", { ...base, q: "cafe expresso" });
    await models(true);
    expect(data).toEqual([]);
  });
  it("hides affiliate products from suggestions while affiliates are off", async () => {
    await models(false);
    const { data } = await anonClient().rpc("suggest", { q: "cafe exp", p_locale: "pt-BR", p_limit: 8 });
    await models(true);
    expect((data ?? []).filter((r) => r.kind === "product")).toEqual([]);
  });
});

describe("search_products", () => {
  it("is accent-insensitive", async () => {
    const { data, error } = await anonClient().rpc("search_products", { ...base, q: "cafe expresso" });
    expect(error).toBeNull();
    expect(data?.map((r) => r.name)).toContain("Café Expresso Máquina");
  });
  it("tolerates LIKE/SQL metacharacters", async () => {
    const { data, error } = await anonClient().rpc("search_products", { ...base, q: String.raw`%_\'` });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
  it("tolerates a 500-character query", async () => {
    const { error } = await anonClient().rpc("search_products", { ...base, q: "a".repeat(500) });
    expect(error).toBeNull();
  });
  it("never returns drafts", async () => {
    const { data } = await anonClient().rpc("search_products", { ...base, q: "rascunho secreto" });
    expect(data?.map((r) => r.name) ?? []).not.toContain("Café Rascunho Secreto");
  });
  it("returns a total count", async () => {
    const { data } = await anonClient().rpc("search_products", { ...base, q: "cafe" });
    expect(Number(data?.[0]?.total_count)).toBeGreaterThan(0);
  });
});

describe("suggest", () => {
  it("suggests products by prefix", async () => {
    const { data, error } = await anonClient().rpc("suggest", { q: "caf", p_locale: "pt-BR", p_limit: 5 });
    expect(error).toBeNull();
    expect(data?.some((r) => r.kind === "product" && r.label === "Café Expresso Máquina")).toBe(true);
  });
});
