export const ORDER_STATUSES = [
  "awaiting_payment",
  "paid",
  "awaiting_supplier",
  "supplier_purchased",
  "shipped",
  "in_transit",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ADMIN_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pagamento confirmado",
  awaiting_supplier: "Aguardando compra do fornecedor",
  supplier_purchased: "Produto comprado no fornecedor",
  shipped: "Produto enviado",
  in_transit: "Em trânsito",
  delivered: "Entregue",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

export type CustomerStage = "awaiting_payment" | "preparing" | "shipped" | "delivered" | "cancelled" | "refunded";

export const CUSTOMER_STAGE_LABEL: Record<CustomerStage, string> = {
  awaiting_payment: "Aguardando pagamento",
  preparing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

export function isOrderStatus(s: string): s is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(s);
}

export function customerStage(status: OrderStatus): CustomerStage {
  switch (status) {
    case "awaiting_payment":
      return "awaiting_payment";
    case "paid":
    case "awaiting_supplier":
    case "supplier_purchased":
      return "preparing";
    case "shipped":
    case "in_transit":
      return "shipped";
    default:
      return status;
  }
}

/** Mirrors the SQL guard in customer_cancel_order: only before any item was bought at a supplier. */
export function canCustomerCancel(status: OrderStatus, anyItemPurchased: boolean): boolean {
  return !anyItemPurchased && (status === "awaiting_payment" || status === "paid" || status === "awaiting_supplier");
}

/** Only the Stripe webhook moves an order to paid, so an unpaid order can only be cancelled. */
export function adminCanSetStatus(to: OrderStatus, from?: OrderStatus): boolean {
  if (from === "awaiting_payment" && to !== "cancelled") return false;
  return to !== "paid" && to !== "awaiting_payment";
}
