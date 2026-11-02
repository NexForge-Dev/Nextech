import { describe, it, expect, afterEach } from "vitest";
import { sendEmail } from "@/lib/email/send";
import { renderEmail, type EmailOrder } from "@/lib/email/templates";

const order: EmailOrder = {
  number: 1001,
  customerName: "Ana <script>alert(1)</script>",
  totalMinor: 43980,
  items: [{ name: "Fone X", quantity: 1, lineTotalMinor: 43980, trackingCarrier: "Correios", trackingCode: "BR123456789BR", trackingUrl: null }],
  paymentMethod: "card",
  siteUrl: "https://nextech.example",
};

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

describe("sendEmail", () => {
  it("skips (without throwing) when the provider is not configured", async () => {
    let called = false;
    const r = await sendEmail({ to: "a@b.com", subject: "x", html: "x", text: "x" }, (async () => ((called = true), new Response("{}"))) as unknown as typeof fetch);
    expect(r).toEqual({ sent: false });
    expect(called).toBe(false);
  });
  it("posts to Resend with the configured sender", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "NEXTECH <pedidos@x.com>";
    let body: Record<string, unknown> = {};
    const r = await sendEmail({ to: "a@b.com", subject: "Oi", html: "<p>x</p>", text: "x" }, (async (_u: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: "e1" }), { status: 200 });
    }) as unknown as typeof fetch);
    expect(r).toEqual({ sent: true });
    expect(body).toMatchObject({ from: "NEXTECH <pedidos@x.com>", to: ["a@b.com"], subject: "Oi" });
  });
  it("never throws when the provider fails", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "x@x.com";
    expect(await sendEmail({ to: "a@b.com", subject: "x", html: "x", text: "x" }, (async () => { throw new Error("down"); }) as unknown as typeof fetch)).toEqual({ sent: false });
  });
});

describe("email templates", () => {
  it("escapes customer content", () => {
    const m = renderEmail("orderConfirmed", order);
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.subject).toBe("Pedido #1001 confirmado");
  });
  it("lists tracking codes without supplier names", () => {
    const m = renderEmail("orderShipped", order);
    expect(m.html).toContain("BR123456789BR");
    expect(m.text).toContain("Correios");
    expect(m.html.toLowerCase()).not.toContain("amazon");
  });
  it("an owner alert carries the reason", () => {
    const m = renderEmail("ownerAlert", { ...order, alert: "O reembolso automático de R$ 439,80 falhou no Stripe." });
    expect(m.subject).toBe("Atenção: pedido #1001");
    expect(m.text).toContain("O reembolso automático de R$ 439,80 falhou no Stripe.");
  });
  it("renders every kind with a subject and a text version", () => {
    for (const k of ["orderConfirmed", "boletoIssued", "paymentFailed", "orderShipped", "orderDelivered", "orderCancelled", "orderRefunded", "returnReceived", "returnResolved", "ownerNewOrder", "ownerDispute", "ownerManualRefund", "ownerAlert"] as const) {
      const m = renderEmail(k, { ...order, refundMinor: 1000, boletoUrl: "https://payments.stripe.com/b", outcome: "Reembolso total" });
      expect(m.subject.length).toBeGreaterThan(5);
      expect(m.text.length).toBeGreaterThan(10);
    }
  });
});
