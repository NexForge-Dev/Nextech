import "server-only";
import { createServiceSupabase } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { renderEmail, type EmailKind, type EmailOrder } from "@/lib/email/templates";
import { sellerContactLine, type LegalSettings } from "@/lib/domain/seller";
import { log } from "@/lib/log";

const OWNER_KINDS: EmailKind[] = ["ownerNewOrder", "ownerDispute", "ownerManualRefund", "ownerAlert"];
/** Something needs the owner's action. Stored as an order event, so the admin panel shows it with or without e-mail. */
const ACTION_KINDS: EmailKind[] = ["ownerDispute", "ownerManualRefund", "ownerAlert"];

async function recordOwnerAlert(kind: EmailKind, orderId: string, extra: Partial<EmailOrder>, emailed: boolean) {
  if (!ACTION_KINDS.includes(kind)) return;
  if (!emailed) log.error("orders.owner_alert_not_emailed", new Error(kind), { orderId, alert: extra.alert ?? null });
  await createServiceSupabase().from("order_events").insert({ order_id: orderId, actor: "system", kind: "owner_alert", data: { template: kind, alert: extra.alert ?? null, refundMinor: extra.refundMinor ?? null, emailed } });
}

/** Send an order email (customer or owner) and record it in the order history. Never throws. */
export async function notifyOrder(kind: EmailKind, orderId: string, extra: Partial<EmailOrder> = {}): Promise<void> {
  try {
    const svc = createServiceSupabase();
    const { data: o } = await svc.from("orders").select("id, number, total_minor, payment_method, customer, boleto, order_items(name, quantity, line_total_minor, tracking_carrier, tracking_code, tracking_url)").eq("id", orderId).maybeSingle();
    if (!o) return;
    const customer = (o.customer ?? {}) as { name?: string; email?: string };
    const { data: settings } = await svc.from("site_settings").select("key, value").in("key", ["public.legal", "public.contact_email"]);
    const legal = (settings?.find((r) => r.key === "public.legal")?.value ?? null) as Partial<LegalSettings> | null;
    const contact = settings?.find((r) => r.key === "public.contact_email")?.value;
    const seller = sellerContactLine(legal, typeof contact === "string" ? contact : "");
    const boleto = (o.boleto ?? null) as { url?: string } | null;
    const email: EmailOrder = {
      number: Number(o.number),
      customerName: customer.name?.split(" ")[0] ?? "cliente",
      totalMinor: Number(o.total_minor),
      paymentMethod: o.payment_method,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3300",
      boletoUrl: boleto?.url ?? null,
      seller,
      items: o.order_items.map((i) => ({ name: i.name, quantity: i.quantity, lineTotalMinor: Number(i.line_total_minor), trackingCarrier: i.tracking_carrier, trackingCode: i.tracking_code, trackingUrl: i.tracking_url })),
      ...extra,
    };
    if (OWNER_KINDS.includes(kind)) email.customerName = customer.name ?? "cliente";
    const to = OWNER_KINDS.includes(kind) ? (process.env.OWNER_ALERT_EMAIL ?? "") : (customer.email ?? "");
    const msg = renderEmail(kind, email);
    const { sent } = await sendEmail({ to, ...msg });
    await svc.from("order_events").insert({ order_id: o.id, actor: "system", kind: sent ? "email_sent" : "email_skipped", data: { template: kind, to: OWNER_KINDS.includes(kind) ? "owner" : "customer" } });
    await recordOwnerAlert(kind, o.id, extra, sent);
  } catch (e) {
    // emails must never break order processing, but a lost alert has to leave a trace
    log.error("orders.notify_failed", e, { kind, orderId });
    await recordOwnerAlert(kind, orderId, extra, false).catch(() => undefined);
  }
}
