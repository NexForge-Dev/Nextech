import "server-only";
import { createServiceSupabase } from "@/lib/supabase/service";
import { estimateMarginMinor } from "@/lib/domain/own-pricing";
import { isOrderStatus, type OrderStatus } from "@/lib/domain/order-status";

// Callers must have passed pageGuard("orders.read"): these queries use the service role.

export const ORDERS_PAGE_SIZE = 25;

export type AdminOrderRow = {
  id: string;
  number: number;
  createdAt: string;
  customer: string;
  email: string;
  totalMinor: number;
  paymentMethod: string;
  paid: boolean;
  status: OrderStatus;
  marginMinor: number | null;
  marginPct: number | null;
};

export async function listOrders(f: { q?: string; status?: string; payment?: string; from?: string; to?: string; page: number }): Promise<{ rows: AdminOrderRow[]; total: number }> {
  const svc = createServiceSupabase();
  let q = svc
    .from("orders")
    .select("id, number, created_at, customer, total_minor, payment_method, paid_at, status, stripe_fee_minor, refunded_minor, order_items(supplier_cost_minor, quantity)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((f.page - 1) * ORDERS_PAGE_SIZE, f.page * ORDERS_PAGE_SIZE - 1);
  if (f.status && isOrderStatus(f.status)) q = q.eq("status", f.status);
  if (f.payment === "paid") q = q.not("paid_at", "is", null);
  if (f.payment === "unpaid") q = q.is("paid_at", null);
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) q = q.gte("created_at", f.from);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) q = q.lt("created_at", new Date(new Date(f.to).getTime() + 86_400_000).toISOString());
  const term = f.q?.trim().replace(/[%,()*]/g, "").slice(0, 80);
  if (term) {
    const n = Number(term.replace(/^#/, ""));
    q = Number.isInteger(n) && n > 0 ? q.eq("number", n) : q.or(`customer->>name.ilike.%${term}%,customer->>email.ilike.%${term}%`);
  }
  const { data, count } = await q;
  return {
    total: count ?? 0,
    rows: (data ?? []).map((o) => {
      const c = (o.customer ?? {}) as { name?: string; email?: string };
      const costs = o.order_items.map((i) => i.supplier_cost_minor);
      const allCosts = costs.length > 0 && costs.every((x) => x != null);
      const m = o.paid_at && allCosts
        ? estimateMarginMinor({ revenueMinor: Number(o.total_minor) - Number(o.refunded_minor), feeMinor: Number(o.stripe_fee_minor ?? 0), costMinor: costs.reduce<number>((a, b) => a + Number(b), 0) })
        : null;
      return {
        id: o.id,
        number: Number(o.number),
        createdAt: o.created_at,
        customer: c.name ?? "—",
        email: c.email ?? "",
        totalMinor: Number(o.total_minor),
        paymentMethod: o.payment_method,
        paid: !!o.paid_at,
        status: isOrderStatus(o.status) ? o.status : "awaiting_payment",
        marginMinor: m?.marginMinor ?? null,
        marginPct: m?.marginPct ?? null,
      };
    }),
  };
}

export async function countAwaitingSupplier(): Promise<number> {
  const { count } = await createServiceSupabase().from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "awaiting_supplier"]);
  return count ?? 0;
}

export async function countOpenReturns(): Promise<number> {
  const { count } = await createServiceSupabase().from("return_requests").select("id", { count: "exact", head: true }).eq("status", "open");
  return count ?? 0;
}

export type AdminOrderDetail = Awaited<ReturnType<typeof getOrderAdmin>>;

export async function getOrderAdmin(orderNumber: number) {
  if (!Number.isInteger(orderNumber) || orderNumber < 1) return null;
  const svc = createServiceSupabase();
  const { data: o } = await svc
    .from("orders")
    .select("*, order_items(*, suppliers(name)), order_events(id, at, actor, actor_id, kind, data), order_refunds(id, amount_minor, method, status, note, created_at), return_requests(id, reason, message, photo_paths, status, outcome, outcome_note, created_at, resolved_at)")
    .eq("number", orderNumber)
    .maybeSingle();
  if (!o) return null;
  const productIds = o.order_items.map((i) => i.product_id).filter((x): x is string => !!x);
  const [{ data: suggestions }, { data: suppliers }] = await Promise.all([
    productIds.length ? svc.from("product_suppliers").select("product_id, supplier_id, url, cost_minor, is_primary, suppliers(name)").in("product_id", productIds) : Promise.resolve({ data: [] as never[] }),
    svc.from("suppliers").select("id, name").eq("active", true).order("name"),
  ]);
  const costs = o.order_items.map((i) => i.supplier_cost_minor);
  const allCosts = costs.length > 0 && costs.every((x) => x != null);
  const costMinor = allCosts ? costs.reduce<number>((a, b) => a + Number(b), 0) : null;
  const revenueMinor = Number(o.total_minor) - Number(o.refunded_minor);
  return {
    id: o.id,
    number: Number(o.number),
    createdAt: o.created_at,
    status: (isOrderStatus(o.status) ? o.status : "awaiting_payment") as OrderStatus,
    paymentMethod: o.payment_method,
    paymentSummary: o.payment_summary,
    paidAt: o.paid_at,
    totalMinor: Number(o.total_minor),
    subtotalMinor: Number(o.subtotal_minor),
    discountMinor: Number(o.discount_minor),
    refundedMinor: Number(o.refunded_minor),
    stripeFeeMinor: o.stripe_fee_minor == null ? null : Number(o.stripe_fee_minor),
    stripePaymentIntentId: o.stripe_payment_intent_id,
    customer: o.customer as { name: string; email: string; cpf: string; phone: string },
    shipping: o.shipping as { recipientName: string; street: string; number: string; complement: string | null; district: string; city: string; state: string; cep: string },
    invoicePath: o.invoice_path,
    costMinor,
    margin: o.paid_at && costMinor != null ? estimateMarginMinor({ revenueMinor, feeMinor: Number(o.stripe_fee_minor ?? 0), costMinor }) : null,
    items: o.order_items.map((i) => {
      const sug = (suggestions ?? []).filter((s) => s.product_id === i.product_id).sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
      return {
        id: i.id,
        name: i.name,
        slug: i.slug,
        quantity: i.quantity,
        unitPriceMinor: Number(i.unit_price_minor),
        lineTotalMinor: Number(i.line_total_minor),
        supplierId: i.supplier_id,
        supplierName: i.suppliers?.name ?? null,
        supplierCostMinor: i.supplier_cost_minor == null ? null : Number(i.supplier_cost_minor),
        supplierOrderRef: i.supplier_order_ref,
        supplierUrl: i.supplier_url,
        purchasedAt: i.supplier_purchased_at,
        trackingCarrier: i.tracking_carrier,
        trackingCode: i.tracking_code,
        trackingUrl: i.tracking_url,
        suggestion: sug ? { supplierId: sug.supplier_id, name: sug.suppliers?.name ?? "", url: sug.url, costMinor: sug.cost_minor == null ? null : Number(sug.cost_minor) * i.quantity } : null,
      };
    }),
    events: [...o.order_events].sort((a, b) => a.at.localeCompare(b.at)),
    refunds: o.order_refunds,
    returns: o.return_requests,
    suppliers: suppliers ?? [],
  };
}

export async function listReturns(status: "open" | "resolved" = "open") {
  const { data } = await createServiceSupabase()
    .from("return_requests")
    .select("id, reason, message, status, outcome, created_at, resolved_at, orders(number, customer, total_minor)")
    .eq("status", status)
    .order("created_at", { ascending: status === "open" })
    .limit(200);
  return (data ?? []).map((r) => ({
    id: r.id,
    reason: r.reason,
    message: r.message,
    status: r.status,
    outcome: r.outcome,
    createdAt: r.created_at,
    orderNumber: r.orders ? Number(r.orders.number) : null,
    customer: ((r.orders?.customer ?? {}) as { name?: string }).name ?? "—",
  }));
}

/** Own-store KPIs for the last `days` days (paid orders only). */
export async function orderKpis(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await createServiceSupabase()
    .from("orders")
    .select("total_minor, refunded_minor, stripe_fee_minor, order_items(supplier_cost_minor)")
    .not("paid_at", "is", null)
    .gte("paid_at", since)
    .limit(5000);
  let revenue = 0;
  let margin = 0;
  let marginKnown = 0;
  for (const o of data ?? []) {
    const net = Number(o.total_minor) - Number(o.refunded_minor);
    revenue += net;
    const costs = o.order_items.map((i) => i.supplier_cost_minor);
    if (costs.length && costs.every((c) => c != null)) {
      margin += net - Number(o.stripe_fee_minor ?? 0) - costs.reduce<number>((a, b) => a + Number(b), 0);
      marginKnown += 1;
    }
  }
  return { paidOrders: (data ?? []).length, revenueMinor: revenue, marginMinor: margin, marginKnown, awaitingSupplier: await countAwaitingSupplier() };
}
