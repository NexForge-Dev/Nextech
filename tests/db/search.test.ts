import { describe, it, expect, beforeAll } from "vitest";
import { anonClient, makeProduct } from "./helpers";

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

beforeAll(async () => {
  await makeProduct({ name: "Café Expresso Máquina" });
  await makeProduct({ name: "Café Rascunho Secreto", status: "draft" });
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
