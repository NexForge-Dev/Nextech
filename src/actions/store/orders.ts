"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { getStripe } from "@/lib/stripe/server";
import { cancelOrderWith, type CancelResult } from "@/lib/orders/cancel";
import { notifyOrder } from "@/lib/orders/notify";
import { log } from "@/lib/log";
import { analytics } from "@/lib/analytics";

export async function cancelMyOrder(orderNumber: number): Promise<CancelResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Entre na sua conta." };
  if (!(await rateLimit("orders", user.id))) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
  const sb = await createServerSupabase();
  const svc = createServiceSupabase();
  const r = await cancelOrderWith(
    {
      async cancelInDb(n) {
        const { data, error } = await sb.rpc("customer_cancel_order", { p_number: n });
        if (error) throw new Error(error.message);
        const row = data?.[0];
        if (!row) throw new Error("order_not_found");
        const { data: o } = await svc.from("orders").select("refunded_minor").eq("id", row.order_id).maybeSingle();
        return { ...row, total_minor: Number(row.total_minor), refunded_minor: Number(o?.refunded_minor ?? 0) };
      },
      async refund(pi, amount, key) {
        try {
          const refund = await getStripe().refunds.create({ payment_intent: pi, amount, reason: "requested_by_customer", metadata: { source: "customer_cancel" } }, { idempotencyKey: key });
          await svc.rpc("order_record_refund", {
            p_order: null as never,
            p_pi: pi,
            p_amount: amount,
            p_method: "stripe",
            p_stripe_refund: refund.id,
            p_status: refund.status === "succeeded" ? "succeeded" : "pending",
            p_note: "Cancelado pelo cliente" as never,
            p_actor: null as never,
          });
          return true;
        } catch (e) {
          // the order is cancelled; the failed refund shows in the history and the owner refunds from the admin
          log.error("orders.cancel_refund_failed", e, { pi });
          const { data: o } = await svc.from("orders").select("id").eq("stripe_payment_intent_id", pi).maybeSingle();
          if (o) await svc.from("order_events").insert({ order_id: o.id, actor: "system", kind: "refund_failed", data: { amount } });
          return false;
        }
      },
      async cancelPaymentIntent(pi) {
        await getStripe().paymentIntents.cancel(pi);
      },
      async recordManualPending(orderId, amount) {
        await svc.from("order_events").insert({ order_id: orderId, actor: "system", kind: "manual_refund_pending", data: { amount } });
      },
      async notify(kind, orderId, extra) {
        await notifyOrder(kind, orderId, extra);
      },
    },
    orderNumber,
  );
  if (r.ok) analytics.feature(user.id, "pedido_cancelado");
  revalidatePath("/[locale]/minha-conta/pedidos", "layout");
  return r;
}

const returnSchema = z.object({
  number: z.coerce.number().int().positive(),
  reason: z.enum(["withdrawal", "defect", "other"], { message: "Escolha o motivo." }),
  message: z.string().trim().min(5, "Descreva o que aconteceu (mín. 5 caracteres).").max(2000),
});
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type ReturnState = { ok: boolean; error?: string; fieldErrors?: Record<string, string[]> } | null;

export async function requestReturn(_: ReturnState, form: FormData): Promise<ReturnState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Entre na sua conta." };
  if (!(await rateLimit("orders", user.id))) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
  const parsed = returnSchema.safeParse({ number: form.get("number"), reason: form.get("reason"), message: form.get("message") });
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 3) return { ok: false, fieldErrors: { photos: ["Envie no máximo 3 fotos."] } };
  for (const f of files) {
    if (!PHOTO_TYPES[f.type]) return { ok: false, fieldErrors: { photos: ["Use fotos JPG, PNG ou WebP."] } };
    if (f.size > 5 * 1024 * 1024) return { ok: false, fieldErrors: { photos: ["Cada foto pode ter até 5 MB."] } };
  }
  const sb = await createServerSupabase();
  const paths: string[] = [];
  for (const f of files) {
    const path = `${user.id}/${parsed.data.number}-${crypto.randomUUID()}.${PHOTO_TYPES[f.type]}`;
    const { error } = await sb.storage.from("returns").upload(path, f, { contentType: f.type });
    if (error) return { ok: false, error: "Não foi possível enviar as fotos. Tente novamente." };
    paths.push(path);
  }
  const { error } = await sb.rpc("create_return_request", { p_number: parsed.data.number, p_reason: parsed.data.reason, p_message: parsed.data.message, p_photos: paths });
  if (error) {
    const msg =
      error.message === "already_open" ? "Você já tem uma solicitação aberta para este pedido." : error.message === "not_returnable" ? "Este pedido ainda não pode ter devolução." : "Não foi possível enviar a solicitação.";
    return { ok: false, error: msg };
  }
  const { data: o } = await sb.from("my_orders").select("id").eq("number", parsed.data.number).maybeSingle();
  if (o?.id) await notifyOrder("returnReceived", o.id);
  analytics.feature(user.id, "devolucao_solicitada");
  revalidatePath("/[locale]/minha-conta/pedidos", "layout");
  return { ok: true };
}

/** Short-lived download link for the order's invoice (nota fiscal), owner only. */
export async function myInvoiceUrl(orderNumber: number): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const sb = await createServerSupabase();
  const { data: o } = await sb.from("my_orders").select("id, has_invoice").eq("number", orderNumber).maybeSingle();
  if (!o?.id || !o.has_invoice) return null;
  const svc = createServiceSupabase();
  const { data: row } = await svc.from("orders").select("invoice_path").eq("id", o.id).single();
  if (!row?.invoice_path) return null;
  const { data } = await svc.storage.from("invoices").createSignedUrl(row.invoice_path, 300);
  if (data?.signedUrl) analytics.feature(user.id, "nota_fiscal_baixada");
  return data?.signedUrl ?? null;
}
