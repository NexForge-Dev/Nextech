import "server-only";
import { after } from "next/server";
import { log } from "@/lib/log";
import { createNexforge, type NexforgeClient, type NexforgeEvent } from "./nexforge-client.cjs";

/**
 * Product metrics for the internal NexForge management panel (Painel de Gestão NexForge).
 *
 * Only the event name, a pseudonymous id (HMAC of the Supabase user id with
 * NEXFORGE_PSEUDONYM_SECRET, which never leaves this server) and fixed codes/amounts are
 * sent — never names, e-mails, CPF, addresses or order numbers. Sold items carry catalogue slugs
 * (product, category, brand), which say what was sold and never who bought it. Without the three
 * NEXFORGE_* variables (and always under NODE_ENV=test) every call is a no-op.
 * Sending happens after the response via `after()`, so it never slows a request.
 */

let client: NexforgeClient | null = null;

function nf(): NexforgeClient {
  if (!client) {
    client = createNexforge({
      endpoint: process.env.NEXFORGE_ENDPOINT,
      ingestKey: process.env.NEXFORGE_INGEST_KEY,
      pseudonymSecret: process.env.NEXFORGE_PSEUDONYM_SECRET,
      enabled: process.env.NODE_ENV !== "test",
      timeoutMs: 2500,
      retries: 1,
      onError: (err) => log.info("nexforge.failed", { reason: err instanceof Error ? err.message.slice(0, 80) : "unknown" }),
    });
  }
  return client;
}

function flushLater(c: NexforgeClient) {
  try {
    after(() => c.flush(3000));
  } catch {
    // Outside a request scope (scripts): send now without waiting.
    void c.flush(3000);
  }
}

type Props = Record<string, string | number>;

function track(event: NexforgeEvent, userId: string | null | undefined, properties: Props = {}, opts: { once?: string } = {}) {
  try {
    const c = nf();
    if (!c.enabled || !userId) return;
    c.track(event, {
      userId,
      properties: { platform: "web", locale: "pt-BR", ...properties },
      eventId: opts.once ? c.onceId(opts.once, event, userId) : undefined,
    });
    flushLater(c);
  } catch (e) {
    log.info("nexforge.failed", { reason: e instanceof Error ? e.message.slice(0, 80) : "unknown" });
  }
}

/** Feature keys allowlisted for Nextech in the panel (Administração → Projetos). */
export type Feature =
  | "produto_favoritado"
  | "checkout_iniciado"
  | "boleto_emitido"
  | "pedido_pago"
  | "pedido_cancelado"
  | "devolucao_solicitada"
  | "nota_fiscal_baixada"
  | "perfil_atualizado"
  | "exportacao_dados";

/** Funnel steps, in order (see the panel's project configuration). */
export type Step = "email_confirmado" | "primeiro_checkout" | "primeira_compra";

export const analytics = {
  feature: (userId: string, feature: Feature) => track("feature_used", userId, { feature }),
  /** One-time: only the first occurrence per account counts. */
  step: (userId: string, step: Step) => track("signup_step_completed", userId, { step }, { once: step }),
  signupStarted: (userId: string) => track("signup_started", userId, { method: "email" }, { once: "signup" }),
  signupCompleted: (userId: string) => track("signup_completed", userId, { method: "email" }, { once: "signup" }),
  session: (userId: string) => track("session_started", userId),
  checkoutStarted: (userId: string) => {
    track("checkout_started", userId, { plan: "compra", billing_period: "one_off" });
    analytics.feature(userId, "checkout_iniciado");
    analytics.step(userId, "primeiro_checkout");
  },
  /** A paid order = one-off purchase in the panel (one-off revenue, never MRR). */
  orderPaid: (userId: string, orderId: string, totalMinor: number) => {
    track("plan_activated", userId, { plan: "compra", billing_period: "one_off", amount_cents: Math.round(totalMinor), currency: "BRL" }, { once: `order:${orderId}` });
    analytics.feature(userId, "pedido_pago");
    analytics.step(userId, "primeira_compra");
    track("onboarding_completed", userId, {}, { once: "onboarding" });
  },
  /** One event per order line, once per line however many times the webhook is delivered. */
  orderItems: (userId: string, orderId: string, items: { id: string; properties: Props }[]) => {
    for (const i of items) track("item_sold", userId, i.properties, { once: `order:${orderId}:${i.id}` });
  },
  /**
   * A finished refund. `refundKey` is stable per refund, because the admin action and several Stripe
   * events all report the same one. Orders of deleted accounts still count, under an id of the order.
   */
  refund: (userId: string | null, orderId: string, refundKey: string, r: { amountMinor: number; full: boolean; method: "stripe" | "manual" }) =>
    track("refund_recorded", userId ?? `order:${orderId}`, { amount_cents: Math.round(r.amountMinor), currency: "BRL", scope: r.full ? "full" : "partial", method: r.method }, { once: `refund:${refundKey}` }),
  /** One per Stripe event: each decline counts, a retried delivery of the same event does not. */
  paymentFailed: (userId: string, stripeEventId: string) => track("payment_failed", userId, { plan: "compra" }, { once: `stripe:${stripeEventId}` }),
  accountDeleted: (userId: string) => track("account_deleted", userId, {}, { once: "deleted" }),
};
