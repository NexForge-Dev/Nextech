import { describe, it, expect } from "vitest";
import { buildSalesBi, lineShare, panelItems, panelSlug, type BiCatalog, type BiOrder, type BiRefund } from "@/lib/domain/sales-bi";

const from = new Date("2026-11-01T03:00:00Z");
const to = new Date("2026-11-03T02:59:59Z");
const catalog: BiCatalog = new Map([
  ["fone", { category: "Áudio", brand: "Sonora" }],
  ["caixa", { category: "Áudio", brand: null }],
  ["mouse", { category: "Periféricos", brand: "Keyra" }],
]);
const order = (o: Partial<BiOrder> & { id: string }): BiOrder => ({
  userId: "u1",
  paidAt: "2026-11-01T15:00:00Z",
  totalMinor: 10_000,
  subtotalMinor: 10_000,
  refundedMinor: 0,
  paymentMethod: "card",
  feeMinor: 500,
  items: [],
  ...o,
});
const item = (productId: string | null, quantity: number, lineTotalMinor: number, supplierCostMinor: number | null = null) => ({ productId, name: `Item ${productId}`, quantity, lineTotalMinor, supplierCostMinor });
const refund = (r: Partial<BiRefund>): BiRefund => ({ orderId: "a", orderNumber: 1001, amountMinor: 1000, status: "succeeded", method: "stripe", createdAt: "2026-11-02T15:00:00Z", ...r });

describe("buildSalesBi", () => {
  it("ranks products and categories by units", () => {
    const bi = buildSalesBi({
      orders: [order({ id: "a", items: [item("fone", 1, 6000), item("mouse", 1, 4000)] }), order({ id: "b", userId: "u2", totalMinor: 9000, subtotalMinor: 9000, items: [item("mouse", 3, 9000)] })],
      refunds: [],
      catalog,
      from,
      to,
    });
    expect(bi.products.map((p) => p.key)).toEqual(["mouse", "fone"]);
    expect(bi.products[0]).toMatchObject({ units: 4, orders: 2, revenueMinor: 13_000 });
    expect(bi.categories.map((c) => [c.label, c.units])).toEqual([["Periféricos", 4], ["Áudio", 1]]);
    expect(bi.totals).toMatchObject({ grossMinor: 19_000, netMinor: 19_000, orders: 2, units: 5, buyers: 2, repeatBuyers: 0, averageTicketMinor: 9500 });
  });

  it("gives each line its share of a Pix discount and of a partial refund", () => {
    const bi = buildSalesBi({
      orders: [order({ id: "a", paymentMethod: "pix", subtotalMinor: 10_000, totalMinor: 9000, refundedMinor: 4500, items: [item("fone", 1, 7500), item("mouse", 1, 2500)] })],
      refunds: [],
      catalog,
      from,
      to,
    });
    expect(bi.products.find((p) => p.key === "fone")).toMatchObject({ revenueMinor: 6750, refundedMinor: 3375, refundedOrders: 1 });
    expect(bi.products.find((p) => p.key === "mouse")).toMatchObject({ revenueMinor: 2250, refundedMinor: 1125 });
    expect(bi.methods[0]).toMatchObject({ label: "Pix", revenueMinor: 9000 });
  });

  it("counts only finished refunds, one order once, and keeps pending ones apart", () => {
    const bi = buildSalesBi({
      orders: [order({ id: "a", items: [item("fone", 1, 10_000)] }), order({ id: "b", items: [item("fone", 1, 10_000)] })],
      refunds: [refund({ orderId: "a" }), refund({ orderId: "a", amountMinor: 2000 }), refund({ orderId: "b", status: "pending" }), refund({ orderId: "b", status: "failed" })],
      catalog,
      from,
      to,
    });
    expect(bi.totals).toMatchObject({ refunds: 2, refundedOrders: 1, refundedMinor: 3000, pendingRefunds: 1, netMinor: 17_000, refundRate: 0.5 });
    expect(bi.refundsByDay.find((d) => d.key === "2026-11-02")?.value).toBe(2);
  });

  it("estimates margin only on lines whose cost was recorded", () => {
    const bi = buildSalesBi({ orders: [order({ id: "a", items: [item("fone", 1, 6000, 3000), item("mouse", 1, 4000)] })], refunds: [], catalog, from, to });
    expect(bi.totals).toMatchObject({ marginMinor: 3000, costMinor: 3000, linesWithCost: 1, lines: 2 });
    expect(bi.products.find((p) => p.key === "mouse")?.costMinor).toBeNull();
    expect(buildSalesBi({ orders: [order({ id: "a", items: [item("fone", 1, 10_000)] })], refunds: [], catalog, from, to }).totals.marginMinor).toBeNull();
  });

  it("keeps a sale whose product was deleted, and labels missing category and brand", () => {
    const bi = buildSalesBi({ orders: [order({ id: "a", items: [item(null, 2, 10_000)] })], refunds: [], catalog, from, to });
    expect(bi.products[0]).toMatchObject({ label: "Item null", units: 2 });
    expect(bi.categories[0].label).toBe("Sem categoria");
    expect(bi.brands[0].label).toBe("Sem marca");
  });

  it("uses São Paulo days and zero-fills the period", () => {
    const bi = buildSalesBi({ orders: [order({ id: "a", paidAt: "2026-11-02T02:00:00Z", items: [item("fone", 1, 10_000)] })], refunds: [], catalog, from, to });
    expect(bi.revenueByDay.map((d) => [d.key, d.value])).toEqual([["2026-11-01", 100], ["2026-11-02", 0]]);
    expect(bi.revenueByDay[0].label).toBe("01/11");
  });

  it("is empty but safe with no sales", () => {
    const bi = buildSalesBi({ orders: [], refunds: [], catalog, from, to });
    expect(bi.totals).toMatchObject({ grossMinor: 0, averageTicketMinor: null, refundRate: null, marginMinor: null });
    expect(bi.products).toEqual([]);
  });
});

describe("what goes to the NexForge panel", () => {
  it("keeps slugs within what the panel accepts", () => {
    expect(panelSlug("fone-bluetooth")).toBe("fone-bluetooth");
    expect(panelSlug("cabo-1234567890-usb")).toBe("cabo-123456-usb");
    expect(panelSlug(`${"a".repeat(79)}-b-c`)).toHaveLength(79);
  });

  it("sends the paid share of each line and no customer data", () => {
    const [line] = panelItems({ subtotalMinor: 10_000, totalMinor: 9000 }, [{ id: "i1", slug: "fone", quantity: 2, lineTotalMinor: 10_000, category: "audio", brand: null }]);
    expect(line.properties).toEqual({ product: "fone", category: "audio", quantity: 2, amount_cents: 9000, currency: "BRL" });
  });

  it("splits by share without losing the whole amount by much", () => {
    expect(lineShare(1, 3, 1000) + lineShare(2, 3, 1000)).toBe(1000);
    expect(lineShare(100, 0, 1000)).toBe(0);
  });
});
