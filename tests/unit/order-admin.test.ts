import { describe, it, expect } from "vitest";
import { orderItemSchema, refundSchema, resolveReturnSchema, statusSchema } from "@/lib/admin/schemas/order";
import { canShip, refundableMinor } from "@/lib/orders/admin-rules";

const O = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";

describe("order admin rules", () => {
  it("ships only when every item has a tracking code", () => {
    expect(canShip([{ trackingCode: "BR1" }, { trackingCode: "" }])).toBe(false);
    expect(canShip([{ trackingCode: "BR1" }, { trackingCode: "BR2" }])).toBe(true);
    expect(canShip([])).toBe(false);
  });
  it("computes the refundable amount", () => {
    expect(refundableMinor({ totalMinor: 43980, refundedMinor: 10000, paid: true })).toBe(33980);
    expect(refundableMinor({ totalMinor: 43980, refundedMinor: 0, paid: false })).toBe(0);
  });
});

describe("order admin schemas", () => {
  it("never lets the admin set paid by hand", () => {
    const r = statusSchema.safeParse({ orderId: O, status: "paid", expected: "awaiting_supplier", note: "" });
    expect(!r.success && r.error.issues[0].message).toBe("O pagamento só é confirmado pelo Stripe.");
  });
  it("parses supplier cost to centavos and requires https links", () => {
    const ok = orderItemSchema.safeParse({ itemId: O, supplierId: S, supplierCost: "158,90", supplierOrderRef: "702-1", supplierUrl: "https://www.amazon.com.br/x", trackingCarrier: "Correios", trackingCode: " br123 ", trackingUrl: "", purchased: true });
    expect(ok.success && ok.data).toMatchObject({ supplierCostMinor: 15890, trackingCode: "BR123", trackingUrl: null });
    const bad = orderItemSchema.safeParse({ itemId: O, supplierId: S, supplierCost: "", supplierOrderRef: "", supplierUrl: "http://x.com", trackingCarrier: "", trackingCode: "", trackingUrl: "", purchased: false });
    expect(!bad.success && bad.error.issues[0].path.join(".")).toBe("supplierUrl");
  });
  it("requires the supplier and cost when marking an item as purchased", () => {
    const r = orderItemSchema.safeParse({ itemId: O, supplierId: "", supplierCost: "", supplierOrderRef: "", supplierUrl: "", trackingCarrier: "", trackingCode: "", trackingUrl: "", purchased: true });
    expect(!r.success && r.error.issues.map((i) => i.message)).toEqual(["Informe onde comprou.", "Informe quanto pagou."]);
  });
  it("parses refunds", () => {
    expect(refundSchema.parse({ orderId: O, amount: "100,00", note: "", manual: false }).amountMinor).toBe(10000);
    expect(refundSchema.safeParse({ orderId: O, amount: "0", note: "", manual: false }).success).toBe(false);
  });
  it("requires a refund amount for a partial refund outcome", () => {
    expect(resolveReturnSchema.safeParse({ returnId: O, outcome: "refund_partial", note: "", refundAmount: "" }).success).toBe(false);
    expect(resolveReturnSchema.safeParse({ returnId: O, outcome: "replacement", note: "Enviamos outro", refundAmount: "" }).success).toBe(true);
  });
});
