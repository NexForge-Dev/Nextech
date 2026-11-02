import { describe, it, expect } from "vitest";
import { cartTotals, estimateMarginMinor, estimateStripeFeeMinor, ownDiscountPct, pixPriceMinor } from "@/lib/domain/own-pricing";

const sale = { priceMinor: 24990, compareAtMinor: 29990, pixDiscountPct: 5, available: true, deliveryMinDays: 3, deliveryMaxDays: 7 };

describe("own pricing", () => {
  it("rounds the Pix price half up to the centavo", () => expect(pixPriceMinor(24990, 5)).toBe(23741));
  it("keeps the price when there is no Pix discount", () => expect(pixPriceMinor(24990, 0)).toBe(24990));
  it("computes the discount against the 'from' price", () => expect(ownDiscountPct(sale)).toBe(17));
  it("has no discount without a higher 'from' price", () => {
    expect(ownDiscountPct({ ...sale, compareAtMinor: null })).toBeNull();
    expect(ownDiscountPct({ ...sale, compareAtMinor: 24990 })).toBeNull();
  });
  it("estimates the card fee (3.99% + R$0.39, rounded up)", () => expect(estimateStripeFeeMinor(43980, "card")).toBe(1794));
  it("estimates the boleto fee as R$3.45 flat", () => expect(estimateStripeFeeMinor(43980, "boleto")).toBe(345));
  it("estimates the Pix fee as 1.19%", () => expect(estimateStripeFeeMinor(10000, "pix")).toBe(119));
  it("computes margin and margin %", () => {
    expect(estimateMarginMinor({ revenueMinor: 43980, feeMinor: 1794, costMinor: 28580 })).toEqual({ marginMinor: 13606, marginPct: 31 });
    expect(estimateMarginMinor({ revenueMinor: 0, feeMinor: 0, costMinor: 0 })).toEqual({ marginMinor: 0, marginPct: null });
  });
  it("applies the Pix discount per line only when paying with Pix", () => {
    const lines = [
      { priceMinor: 24990, quantity: 1, pixDiscountPct: 5 },
      { priceMinor: 18990, quantity: 2, pixDiscountPct: 0 },
    ];
    expect(cartTotals(lines, "card")).toEqual({ subtotalMinor: 62970, discountMinor: 0, totalMinor: 62970 });
    expect(cartTotals(lines, "pix")).toEqual({ subtotalMinor: 62970, discountMinor: 1249, totalMinor: 61721 });
  });
});
