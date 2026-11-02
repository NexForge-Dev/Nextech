import { describe, it, expect } from "vitest";
import { listableProducts } from "@/lib/seo/sitemap-products";

describe("listableProducts", () => {
  it("leaves out own-store products that have no price yet", () => {
    const rows = [
      { slug: "a", updated_at: "2026-11-01", sale_mode: "affiliate", product_sale: null },
      { slug: "b", updated_at: "2026-11-01", sale_mode: "own", product_sale: null },
      { slug: "c", updated_at: "2026-11-01", sale_mode: "own", product_sale: { product_id: "x" } },
    ];
    expect(listableProducts(rows).map((r) => r.slug)).toEqual(["a", "c"]);
  });
});
