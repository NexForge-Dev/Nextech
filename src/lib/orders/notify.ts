import "server-only";
import { createServiceSupabase } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { renderEmail, type EmailKind, type EmailOrder } from "@/lib/email/templates";

const OWNER_KINDS: EmailKind[] = ["ownerNewOrder", "ownerDispute", "ownerManualRefund", "ownerAlert"];

/** Send an order email (customer or owner) and record it in the order history. Never throws. */
export async function notifyOrder(kind: EmailKind, orderId: string, extra: Partial<EmailOrder> = {}): Promise<void> {
  try {
    const svc = createServiceSupabase();
    const { data: o } = await svc.from("orders").select("id, number, total_minor, payment_method, customer, boleto, order_items(name, quantity, line_total_minor, tracking_carrier, tracking_code, tracking_url)").eq("id", orderId).maybeSingle();
    if (!o) return;
    const customer = (o.customer ?? {}) as { name?: string; email?: string };
    const boleto = (o.boleto ?? null) as { url?: string } | null;
    const email: EmailOrder = {
      number: Number(o.number),
      customerName: customer.name?.split(" ")[0] ?? "cliente",
      totalMinor: Number(o.total_minor),
      paymentMethod: o.payment_method,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3300",
      boletoUrl: boleto?.url ?? null,
      items: o.order_items.map((i) => ({ name: i.name, quantity: i.quantity, lineTotalMinor: Number(i.line_total_minor), trackingCarrier: i.tracking_carrier, trackingCode: i.tracking_code, trackingUrl: i.tracking_url })),
      ...extra,
    };
    if (OWNER_KINDS.includes(kind)) email.customerName = customer.name ?? "cliente";
    const to = OWNER_KINDS.includes(kind) ? (process.env.OWNER_ALERT_EMAIL ?? "") : (customer.email ?? "");
    const msg = renderEmail(kind, email);
    const { sent } = await sendEmail({ to, ...msg });
    await svc.from("order_events").insert({ order_id: o.id, actor: "system", kind: sent ? "email_sent" : "email_skipped", data: { template: kind, to: OWNER_KINDS.includes(kind) ? "owner" : "customer" } });
  } catch {
    /* emails must never break order processing */
  }
}
