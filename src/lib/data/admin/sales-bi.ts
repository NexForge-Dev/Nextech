import "server-only";
import { createServiceSupabase } from "@/lib/supabase/service";
import { buildSalesBi, type BiCatalog, type BiOrder, type BiRefund } from "@/lib/domain/sales-bi";
import type { Period } from "@/lib/domain/period";

// Callers must have passed pageGuard("orders.read"): these queries use the service role.

const PAGE = 1000;
const MAX_ROWS = 50_000;

/** PostgREST caps a response at 1000 rows, so long periods have to be read page by page. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  while (out.length < MAX_ROWS) {
    const { data, error } = await page(out.length, out.length + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return out;
}

async function loadCatalog(productIds: string[]): Promise<BiCatalog> {
  const catalog: BiCatalog = new Map();
  if (!productIds.length) return catalog;
  const svc = createServiceSupabase();
  const rows = await readAll((from, to) =>
    svc.from("products").select("id, brands(name), categories(slug, category_translations(locale, name))").order("id").range(from, to),
  );
  const wanted = new Set(productIds);
  for (const p of rows) {
    if (!wanted.has(p.id)) continue;
    const category = p.categories?.category_translations.find((t) => t.locale === "pt-BR")?.name ?? p.categories?.slug ?? null;
    catalog.set(p.id, { category, brand: p.brands?.name ?? null });
  }
  return catalog;
}

export async function getSalesBi(period: Period) {
  const svc = createServiceSupabase();
  const fromIso = period.from.toISOString();
  const toIso = period.to.toISOString();
  const [orderRows, refundRows] = await Promise.all([
    readAll((from, to) =>
      svc
        .from("orders")
        .select("id, user_id, paid_at, total_minor, subtotal_minor, refunded_minor, payment_method, stripe_fee_minor, order_items(product_id, name, quantity, line_total_minor, supplier_cost_minor)")
        .not("paid_at", "is", null)
        .gte("paid_at", fromIso)
        .lte("paid_at", toIso)
        .order("paid_at")
        .range(from, to),
    ),
    readAll((from, to) =>
      svc
        .from("order_refunds")
        .select("order_id, amount_minor, status, method, created_at, orders(number)")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at")
        .range(from, to),
    ),
  ]);

  const orders: BiOrder[] = orderRows.map((o) => ({
    id: o.id,
    userId: o.user_id,
    paidAt: o.paid_at!,
    totalMinor: Number(o.total_minor),
    subtotalMinor: Number(o.subtotal_minor),
    refundedMinor: Number(o.refunded_minor),
    paymentMethod: o.payment_method,
    feeMinor: o.stripe_fee_minor == null ? null : Number(o.stripe_fee_minor),
    items: o.order_items.map((i) => ({
      productId: i.product_id,
      name: i.name,
      quantity: i.quantity,
      lineTotalMinor: Number(i.line_total_minor),
      supplierCostMinor: i.supplier_cost_minor == null ? null : Number(i.supplier_cost_minor),
    })),
  }));
  const refunds: BiRefund[] = refundRows.map((r) => ({
    orderId: r.order_id,
    orderNumber: Number(r.orders?.number ?? 0),
    amountMinor: Number(r.amount_minor),
    status: r.status,
    method: r.method,
    createdAt: r.created_at,
  }));
  const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)).filter((id): id is string => !!id))];
  return buildSalesBi({ orders, refunds, catalog: await loadCatalog(productIds), from: period.from, to: period.to });
}
