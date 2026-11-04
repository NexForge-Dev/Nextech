import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { customerStage, isOrderStatus, type CustomerStage, type OrderStatus } from "@/lib/domain/order-status";

export type MyOrderSummary = { number: number; createdAt: string; status: OrderStatus; stage: CustomerStage; totalMinor: number; itemCount: number; firstItem: { name: string; imagePath: string | null } | null };

export async function getMyOrders(): Promise<MyOrderSummary[]> {
  const sb = await createServerSupabase();
  const { data: orders } = await sb.from("my_orders").select("id, number, status, total_minor, created_at").order("created_at", { ascending: false }).limit(100);
  const ids = (orders ?? []).map((o) => o.id).filter((x): x is string => !!x);
  const { data: items } = ids.length ? await sb.from("my_order_items").select("order_id, name, image_path, quantity").in("order_id", ids) : { data: [] };
  return (orders ?? []).flatMap((o) => {
    if (!o.status || !isOrderStatus(o.status)) return [];
    const its = (items ?? []).filter((i) => i.order_id === o.id);
    return [
      {
        number: Number(o.number),
        createdAt: o.created_at ?? "",
        status: o.status,
        stage: customerStage(o.status),
        totalMinor: Number(o.total_minor),
        itemCount: its.reduce((n, i) => n + (i.quantity ?? 0), 0),
        firstItem: its[0] ? { name: its[0].name ?? "", imagePath: its[0].image_path } : null,
      },
    ];
  });
}

export type MyOrderDetail = {
  id: string;
  number: number;
  createdAt: string;
  status: OrderStatus;
  stage: CustomerStage;
  paymentMethod: string;
  paymentSummary: string | null;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  refundedMinor: number;
  anyPurchased: boolean;
  paidAt: string | null;
  shipping: { recipientName: string; street: string; number: string; complement: string | null; district: string; city: string; state: string; cep: string };
  boleto: { url: string; number: string | null; expiresAt: string | null } | null;
  hasInvoice: boolean;
  items: { id: string; name: string; slug: string | null; imagePath: string | null; quantity: number; unitPriceMinor: number; lineTotalMinor: number; trackingCarrier: string | null; trackingCode: string | null; trackingUrl: string | null }[];
  timeline: { at: string; kind: string }[];
  returnRequest: { status: string; reason: string; outcome: string | null; outcomeNote: string | null; createdAt: string } | null;
};

export async function getMyOrder(orderNumber: number): Promise<MyOrderDetail | null> {
  if (!Number.isInteger(orderNumber) || orderNumber < 1) return null;
  const sb = await createServerSupabase();
  const { data: o } = await sb.from("my_orders").select("*").eq("number", orderNumber).maybeSingle();
  if (!o || !o.id || !o.status || !isOrderStatus(o.status)) return null;
  const [{ data: items }, { data: timeline }, { data: returns }] = await Promise.all([
    sb.from("my_order_items").select("*").eq("order_id", o.id),
    sb.rpc("my_order_timeline", { p_number: orderNumber }),
    sb.from("return_requests").select("status, reason, outcome, outcome_note, created_at").eq("order_id", o.id).order("created_at", { ascending: false }).limit(1),
  ]);
  const r = returns?.[0];
  return {
    id: o.id,
    number: Number(o.number),
    createdAt: o.created_at ?? "",
    status: o.status,
    stage: customerStage(o.status),
    paymentMethod: o.payment_method ?? "card",
    paymentSummary: o.payment_summary,
    subtotalMinor: Number(o.subtotal_minor),
    discountMinor: Number(o.discount_minor),
    totalMinor: Number(o.total_minor),
    refundedMinor: Number(o.refunded_minor),
    anyPurchased: !!o.any_purchased,
    paidAt: o.paid_at,
    shipping: o.shipping as MyOrderDetail["shipping"],
    boleto: (o.boleto as MyOrderDetail["boleto"]) ?? null,
    hasInvoice: !!o.has_invoice,
    items: (items ?? []).map((i) => ({
      id: i.id ?? "",
      name: i.name ?? "",
      slug: i.slug,
      imagePath: i.image_path,
      quantity: i.quantity ?? 0,
      unitPriceMinor: Number(i.unit_price_minor),
      lineTotalMinor: Number(i.line_total_minor),
      trackingCarrier: i.tracking_carrier,
      trackingCode: i.tracking_code,
      trackingUrl: i.tracking_url,
    })),
    timeline: (timeline ?? []).map((e) => ({ at: e.at, kind: e.kind })),
    returnRequest: r ? { status: r.status, reason: r.reason, outcome: r.outcome, outcomeNote: r.outcome_note, createdAt: r.created_at } : null,
  };
}
