import { describe, it, expect } from "vitest";
import { buildCartLines, type CartProductRow } from "@/lib/cart/lines";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

const row = (id: string, p: Partial<CartProductRow> = {}): CartProductRow => ({
  id, slug: `p-${id.slice(0, 4)}`, name: "Fone", imagePath: null, saleMode: "own", published: true,
  sale: { priceMinor: 24990, compareAtMinor: null, pixDiscountPct: 5, available: true, deliveryMinDays: 3, deliveryMaxDays: 7 }, ...p,
});

describe("buildCartLines", () => {
  it("prices lines from the database rows, never from the client", () => {
    const lines = buildCartLines([{ productId: A, quantity: 2 }], [row(A)], { ownStore: true });
    expect(lines).toEqual([expect.objectContaining({ productId: A, quantity: 2, priceMinor: 24990, lineTotalMinor: 49980, pixDiscountPct: 5, problem: null })]);
  });
  it("flags sold-out, hidden and missing products", () => {
    const lines = buildCartLines(
      [{ productId: A, quantity: 1 }, { productId: B, quantity: 1 }, { productId: C, quantity: 1 }],
      [row(A, { sale: { ...row(A).sale!, available: false } }), row(B, { saleMode: "affiliate" })],
      { ownStore: true },
    );
    expect(lines.map((l) => [l.productId, l.problem])).toEqual([[A, "unavailable"], [B, "hidden"], [C, "hidden"]]);
  });
  it("hides everything while the own store is off", () => {
    expect(buildCartLines([{ productId: A, quantity: 1 }], [row(A)], { ownStore: false })[0].problem).toBe("hidden");
  });
});
