import { describe, it, expect } from "vitest";
import { ADMIN_STATUS_LABEL, ORDER_STATUSES, adminCanSetStatus, canCustomerCancel, customerStage } from "@/lib/domain/order-status";

describe("order status", () => {
  it("has the nine statuses in order", () =>
    expect(ORDER_STATUSES).toEqual(["awaiting_payment", "paid", "awaiting_supplier", "supplier_purchased", "shipped", "in_transit", "delivered", "cancelled", "refunded"]));
  it("labels statuses with the spec wording", () => {
    expect(ADMIN_STATUS_LABEL.awaiting_supplier).toBe("Aguardando compra do fornecedor");
    expect(ADMIN_STATUS_LABEL.supplier_purchased).toBe("Produto comprado no fornecedor");
  });
  it("maps internal statuses to customer stages", () => {
    expect(customerStage("awaiting_payment")).toBe("awaiting_payment");
    expect(customerStage("paid")).toBe("preparing");
    expect(customerStage("supplier_purchased")).toBe("preparing");
    expect(customerStage("in_transit")).toBe("shipped");
    expect(customerStage("delivered")).toBe("delivered");
    expect(customerStage("refunded")).toBe("refunded");
  });
  it("lets the customer cancel only before any supplier purchase", () => {
    expect(canCustomerCancel("awaiting_supplier", false)).toBe(true);
    expect(canCustomerCancel("awaiting_supplier", true)).toBe(false);
    expect(canCustomerCancel("shipped", false)).toBe(false);
    expect(canCustomerCancel("cancelled", false)).toBe(false);
  });
  it("never lets the admin mark an order paid by hand", () => {
    expect(adminCanSetStatus("paid")).toBe(false);
    expect(adminCanSetStatus("awaiting_payment")).toBe(false);
    expect(adminCanSetStatus("shipped")).toBe(true);
  });
});
