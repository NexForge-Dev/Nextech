export type BiItem = {
  productId: string | null;
  name: string;
  quantity: number;
  lineTotalMinor: number;
  /** What the owner paid the supplier for this whole line; null until recorded. */
  supplierCostMinor: number | null;
};

export type BiOrder = {
  id: string;
  userId: string | null;
  paidAt: string;
  totalMinor: number;
  subtotalMinor: number;
  refundedMinor: number;
  paymentMethod: string;
  feeMinor: number | null;
  items: BiItem[];
};

export type BiRefund = {
  orderId: string;
  orderNumber: number;
  amountMinor: number;
  status: string;
  method: string;
  createdAt: string;
};

export type BiCatalog = Map<string, { category: string | null; brand: string | null }>;

export type BiRow = {
  key: string;
  label: string;
  units: number;
  orders: number;
  revenueMinor: number;
  refundedMinor: number;
  refundedOrders: number;
  /** Null when no line of this row has a recorded supplier cost. */
  costMinor: number | null;
};

export type BiPoint = { key: string; label: string; value: number };

const UNCATEGORIZED = "Sem categoria";
const NO_BRAND = "Sem marca";
const METHOD_LABEL: Record<string, string> = { card: "Cartão", boleto: "Boleto", pix: "Pix" };

/** São Paulo is UTC−3 all year, as in period.ts. */
function saoPauloDay(iso: string): string {
  return new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

function dayLabel(ymd: string): string {
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

function eachDay(from: Date, to: Date): string[] {
  const out: string[] = [];
  const end = saoPauloDay(to.toISOString());
  let cur = saoPauloDay(from.toISOString());
  while (cur <= end) {
    out.push(cur);
    cur = new Date(new Date(`${cur}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
  }
  return out;
}

/**
 * Part of an order that belongs to one line. Pix discounts and partial refunds apply to the whole
 * order, so each line carries its share of the subtotal.
 */
export function lineShare(lineTotalMinor: number, subtotalMinor: number, amountMinor: number): number {
  return subtotalMinor > 0 ? Math.round((lineTotalMinor / subtotalMinor) * amountMinor) : 0;
}

type Bucket = BiRow & { orderIds: Set<string>; refundedOrderIds: Set<string> };

function bucket(map: Map<string, Bucket>, key: string, label: string): Bucket {
  let b = map.get(key);
  if (!b) {
    b = { key, label, units: 0, orders: 0, revenueMinor: 0, refundedMinor: 0, refundedOrders: 0, costMinor: null, orderIds: new Set(), refundedOrderIds: new Set() };
    map.set(key, b);
  }
  return b;
}

function finish(map: Map<string, Bucket>): BiRow[] {
  return [...map.values()]
    .map(({ orderIds, refundedOrderIds, ...row }) => ({ ...row, orders: orderIds.size, refundedOrders: refundedOrderIds.size }))
    .sort((a, b) => b.units - a.units || b.revenueMinor - a.revenueMinor || a.label.localeCompare(b.label, "pt-BR"));
}

/**
 * Sales statistics for a period. Orders count on the day they were paid. Refunds count on the day they
 * happened, so a refund of an order paid last month appears in this month's totals, while the per-product
 * columns describe what became of the orders paid in the period.
 */
export function buildSalesBi(input: { orders: BiOrder[]; refunds: BiRefund[]; catalog: BiCatalog; from: Date; to: Date }) {
  const { orders, refunds, catalog, from, to } = input;
  const products = new Map<string, Bucket>();
  const categories = new Map<string, Bucket>();
  const brands = new Map<string, Bucket>();
  const methods = new Map<string, Bucket>();
  const revenueByDay = new Map<string, number>();
  const unitsByDay = new Map<string, number>();
  const buyers = new Map<string, number>();

  let grossMinor = 0;
  let units = 0;
  let feesMinor = 0;
  let costMinor = 0;
  let linesWithCost = 0;
  let lines = 0;
  let costedRevenueMinor = 0;

  for (const o of orders) {
    const day = saoPauloDay(o.paidAt);
    grossMinor += o.totalMinor;
    feesMinor += o.feeMinor ?? 0;
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + o.totalMinor);
    if (o.userId) buyers.set(o.userId, (buyers.get(o.userId) ?? 0) + 1);

    const method = bucket(methods, o.paymentMethod, METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod);
    method.revenueMinor += o.totalMinor;
    method.units += o.items.reduce((a, i) => a + i.quantity, 0);
    method.orderIds.add(o.id);

    for (const it of o.items) {
      units += it.quantity;
      lines += 1;
      unitsByDay.set(day, (unitsByDay.get(day) ?? 0) + it.quantity);
      const revenue = lineShare(it.lineTotalMinor, o.subtotalMinor, o.totalMinor);
      const refunded = lineShare(it.lineTotalMinor, o.subtotalMinor, o.refundedMinor);
      const info = it.productId ? catalog.get(it.productId) : undefined;
      const targets = [
        bucket(products, it.productId ?? `removido:${it.name}`, it.name),
        bucket(categories, info?.category ?? UNCATEGORIZED, info?.category ?? UNCATEGORIZED),
        bucket(brands, info?.brand ?? NO_BRAND, info?.brand ?? NO_BRAND),
      ];
      for (const b of targets) {
        b.units += it.quantity;
        b.revenueMinor += revenue;
        b.refundedMinor += refunded;
        b.orderIds.add(o.id);
        if (o.refundedMinor > 0) b.refundedOrderIds.add(o.id);
        if (it.supplierCostMinor != null) b.costMinor = (b.costMinor ?? 0) + it.supplierCostMinor;
      }
      if (it.supplierCostMinor != null) {
        costMinor += it.supplierCostMinor;
        linesWithCost += 1;
        costedRevenueMinor += revenue - refunded;
      }
    }
  }

  const done = refunds.filter((r) => r.status === "succeeded");
  const refundedMinor = done.reduce((a, r) => a + r.amountMinor, 0);
  const refundsByDay = new Map<string, number>();
  for (const r of done) {
    const day = saoPauloDay(r.createdAt);
    refundsByDay.set(day, (refundsByDay.get(day) ?? 0) + 1);
  }

  const days = eachDay(from, to);
  const series = (m: Map<string, number>, scale = 1): BiPoint[] => days.map((d) => ({ key: d, label: dayLabel(d), value: (m.get(d) ?? 0) / scale }));
  const count = orders.length;

  return {
    totals: {
      grossMinor,
      refundedMinor,
      netMinor: grossMinor - refundedMinor,
      orders: count,
      units,
      buyers: buyers.size,
      repeatBuyers: [...buyers.values()].filter((n) => n > 1).length,
      averageTicketMinor: count ? Math.round(grossMinor / count) : null,
      refunds: done.length,
      refundedOrders: new Set(done.map((r) => r.orderId)).size,
      pendingRefunds: refunds.filter((r) => r.status === "pending").length,
      /** Orders with a refund in the period ÷ orders paid in the period. */
      refundRate: count ? new Set(done.map((r) => r.orderId)).size / count : null,
      feesMinor,
      costMinor,
      /** Revenue left after refunds minus supplier cost, only on lines whose cost was recorded. */
      marginMinor: linesWithCost ? costedRevenueMinor - costMinor : null,
      linesWithCost,
      lines,
    },
    products: finish(products),
    categories: finish(categories),
    brands: finish(brands),
    methods: finish(methods),
    revenueByDay: series(revenueByDay, 100),
    unitsByDay: series(unitsByDay),
    refundsByDay: series(refundsByDay),
    refunds: [...refunds].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export type SalesBi = ReturnType<typeof buildSalesBi>;

/**
 * Catalogue slug in the shape the NexForge panel accepts: up to 80 characters and no run of 7+ digits,
 * which it refuses as a possible phone or document number.
 */
export function panelSlug(slug: string): string {
  return slug.replace(/\d{7,}/g, (m) => m.slice(0, 6)).slice(0, 80).replace(/-+$/g, "");
}

/** One panel event per order line. The amount is the line's share of what was actually paid. */
export function panelItems(order: { subtotalMinor: number; totalMinor: number }, items: { id: string; slug: string | null; quantity: number; lineTotalMinor: number; category: string | null; brand: string | null }[]) {
  return items.map((i) => ({
    id: i.id,
    properties: {
      product: panelSlug(i.slug || "produto-removido"),
      ...(i.category ? { category: panelSlug(i.category) } : {}),
      ...(i.brand ? { brand: panelSlug(i.brand) } : {}),
      quantity: i.quantity,
      amount_cents: lineShare(i.lineTotalMinor, order.subtotalMinor, order.totalMinor),
      currency: "BRL",
    },
  }));
}
