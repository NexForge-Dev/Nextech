import { describe, it, expect } from "vitest";
import { autoDealProducts, categoryIdsWithProducts, mergeDeals, type CategoryProductRow, type DealRow } from "@/lib/domain/storefront";

const models = { ownStore: true, ownStock: false, dropshipping: true, affiliates: false };
const own = (category_id: string, fulfillment: "stock" | "dropship" = "dropship"): CategoryProductRow => ({ category_id, sale_mode: "own", product_sale: { fulfillment } });

describe("categoryIdsWithProducts", () => {
  it("keeps a category that has a sellable product", () => {
    expect([...categoryIdsWithProducts([own("a")], models)]).toEqual(["a"]);
  });
  it("ignores products of a sale mode that is switched off", () => {
    const rows: CategoryProductRow[] = [own("stock-only", "stock"), { category_id: "affiliate-only", sale_mode: "affiliate", product_sale: null }];
    expect(categoryIdsWithProducts(rows, models).size).toBe(0);
  });
  it("ignores an own product whose sale data the storefront cannot read", () => {
    expect(categoryIdsWithProducts([{ category_id: "a", sale_mode: "own", product_sale: null }], models).size).toBe(0);
  });
});

const deal = (id: string, price: number, compareAt: number | null, extra: Partial<DealRow<{ id: string }>> = {}): DealRow<{ id: string }> => ({
  price_minor: price,
  compare_at_minor: compareAt,
  available: true,
  fulfillment: "dropship",
  stock_quantity: null,
  products: { id },
  ...extra,
});

describe("autoDealProducts", () => {
  it("lists a product whose 'de' price is above its price, biggest discount first", () => {
    const rows = [deal("small", 900, 1000), deal("big", 500, 1000)];
    expect(autoDealProducts(rows, models).map((p) => p.id)).toEqual(["big", "small"]);
  });
  it("leaves out a product without a 'de' price", () => {
    expect(autoDealProducts([deal("plain", 900, null)], models)).toEqual([]);
  });
  it("leaves out a product that cannot be bought", () => {
    const rows = [deal("off", 500, 1000, { available: false }), deal("sold-out", 500, 1000, { fulfillment: "stock", stock_quantity: 0 })];
    expect(autoDealProducts(rows, models)).toEqual([]);
  });
  it("leaves out a product of a sale mode that is switched off", () => {
    const stocked = deal("stocked", 500, 1000, { fulfillment: "stock", stock_quantity: 3 });
    expect(autoDealProducts([stocked], models)).toEqual([]);
    expect(autoDealProducts([stocked], { ...models, ownStock: true }).map((p) => p.id)).toEqual(["stocked"]);
  });
  it("skips a row whose product the storefront cannot read", () => {
    expect(autoDealProducts([deal("x", 500, 1000, { products: null })], models)).toEqual([]);
  });
});

describe("mergeDeals", () => {
  it("keeps manual offers first and never repeats a product", () => {
    expect(mergeDeals([{ id: "m" }, { id: "both" }], [{ id: "both" }, { id: "a" }], 10).map((p) => p.id)).toEqual(["m", "both", "a"]);
  });
  it("respects the limit", () => {
    expect(mergeDeals([{ id: "m" }], [{ id: "a" }, { id: "b" }], 2).map((p) => p.id)).toEqual(["m", "a"]);
  });
});
