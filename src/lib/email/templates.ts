import { formatMoney } from "@/lib/domain/money";

/** Customer-safe order data for emails (never supplier names, links or costs). */
export type EmailOrder = {
  number: number;
  customerName: string;
  totalMinor: number;
  paymentMethod: string;
  siteUrl: string;
  items: { name: string; quantity: number; lineTotalMinor: number; trackingCarrier: string | null; trackingCode: string | null; trackingUrl: string | null }[];
  refundMinor?: number;
  boletoUrl?: string | null;
  outcome?: string;
  /** Owner alerts: what went wrong and what to do. */
  alert?: string;
  /** Seller identity from settings (razão social · CNPJ · endereço · e-mail), shown in customer emails. */
  seller?: string | null;
};

export type EmailKind =
  | "orderConfirmed"
  | "boletoIssued"
  | "paymentFailed"
  | "orderShipped"
  | "orderDelivered"
  | "orderCancelled"
  | "orderRefunded"
  | "returnReceived"
  | "returnResolved"
  | "ownerNewOrder"
  | "ownerDispute"
  | "ownerManualRefund"
  | "ownerAlert";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const money = (m: number) => formatMoney(m, "BRL", "pt-BR");

type Copy = { subject: string; lead: string; showItems?: boolean; showTracking?: boolean; cta?: { label: string; href: string }; rights?: boolean };

function copy(kind: EmailKind, o: EmailOrder): Copy {
  const orderUrl = `${o.siteUrl}/pt-br/minha-conta/pedidos/${o.number}`;
  const adminUrl = `${o.siteUrl}/admin/pedidos/${o.number}`;
  const see = { label: "Ver meu pedido", href: orderUrl };
  switch (kind) {
    case "orderConfirmed":
      return { subject: `Pedido #${o.number} confirmado`, lead: `Olá, ${o.customerName}! Recebemos o pagamento do seu pedido #${o.number}. Agora vamos preparar o envio e avisamos quando sair para entrega.`, showItems: true, cta: see, rights: true };
    case "boletoIssued":
      return { subject: `Boleto do pedido #${o.number}`, lead: `Olá, ${o.customerName}! Seu boleto de ${money(o.totalMinor)} foi gerado. Pague até o vencimento; a confirmação chega em até 1 dia útil.`, showItems: true, cta: o.boletoUrl ? { label: "Abrir boleto", href: o.boletoUrl } : see, rights: true };
    case "paymentFailed":
      return { subject: `Pagamento do pedido #${o.number} não aprovado`, lead: `Olá, ${o.customerName}. O pagamento do pedido #${o.number} não foi concluído. Você pode tentar novamente pelo carrinho, com outro cartão ou forma de pagamento.`, cta: { label: "Ir para a loja", href: `${o.siteUrl}/pt-br/carrinho` } };
    case "orderShipped":
      return { subject: `Pedido #${o.number} enviado`, lead: `Boa notícia, ${o.customerName}! Seu pedido #${o.number} foi enviado. Acompanhe a entrega pelo código de rastreio abaixo.`, showTracking: true, cta: see };
    case "orderDelivered":
      return { subject: `Pedido #${o.number} entregue`, lead: `Olá, ${o.customerName}! Seu pedido #${o.number} foi entregue. Se algo não estiver certo, você tem 7 dias para desistir e a garantia legal (30 dias para produtos não duráveis, 90 dias para duráveis): é só abrir uma solicitação em Meus pedidos.`, cta: see };
    case "orderCancelled":
      return { subject: `Pedido #${o.number} cancelado`, lead: `Olá, ${o.customerName}. Seu pedido #${o.number} foi cancelado.${o.refundMinor ? ` O reembolso de ${money(o.refundMinor)} já foi solicitado e aparece na sua fatura ou conta em até 10 dias úteis.` : ""}`, cta: see };
    case "orderRefunded":
      return { subject: `Reembolso do pedido #${o.number}`, lead: `Olá, ${o.customerName}. Fizemos o reembolso de ${money(o.refundMinor ?? o.totalMinor)} referente ao pedido #${o.number}.${o.paymentMethod === "boleto" ? " Como o pedido foi pago com boleto, o valor foi devolvido por transferência ou Pix." : " O valor aparece na sua fatura ou conta em até 10 dias úteis."}`, cta: see };
    case "returnReceived":
      return { subject: `Recebemos sua solicitação — pedido #${o.number}`, lead: `Olá, ${o.customerName}. Recebemos sua solicitação de devolução ou suporte do pedido #${o.number}. Respondemos em até 5 dias.`, cta: see };
    case "returnResolved":
      return { subject: `Sua solicitação do pedido #${o.number} foi respondida`, lead: `Olá, ${o.customerName}. Sua solicitação do pedido #${o.number} foi analisada: ${o.outcome ?? "veja os detalhes no pedido"}.`, cta: see };
    case "ownerNewOrder":
      return { subject: `Novo pedido pago #${o.number} — ${money(o.totalMinor)}`, lead: `Pedido #${o.number} de ${o.customerName} foi pago (${o.paymentMethod}). Compre os itens no fornecedor e registre no painel.`, showItems: true, cta: { label: "Abrir no painel", href: adminUrl } };
    case "ownerDispute":
      return { subject: `Contestação no pedido #${o.number}`, lead: `O cliente ${o.customerName} contestou o pagamento do pedido #${o.number} (${money(o.totalMinor)}). Responda no painel do Stripe dentro do prazo.`, cta: { label: "Abrir no painel", href: adminUrl } };
    case "ownerManualRefund":
      return { subject: `Reembolso manual pendente — pedido #${o.number}`, lead: `O pedido #${o.number} (boleto) foi cancelado. Peça a chave Pix ao cliente ${o.customerName}, devolva ${money(o.refundMinor ?? o.totalMinor)} pelo seu banco e registre como "reembolsado por fora" no painel.`, cta: { label: "Abrir no painel", href: adminUrl } };
    case "ownerAlert":
      return { subject: `Atenção: pedido #${o.number}`, lead: `${o.alert ?? "Um pedido precisa da sua atenção."} Confira o histórico do pedido #${o.number} no painel.`, cta: { label: "Abrir no painel", href: adminUrl } };
  }
}

/** Plain black-and-white HTML email (table layout for email clients) plus a text version. */
const OWNER_ONLY: EmailKind[] = ["ownerNewOrder", "ownerDispute", "ownerManualRefund", "ownerAlert"];

export function renderEmail(kind: EmailKind, o: EmailOrder): { subject: string; html: string; text: string } {
  const c = copy(kind, o);
  const customer = !OWNER_ONLY.includes(kind);
  const termsUrl = `${o.siteUrl}/pt-br/termos`;
  const returnsUrl = `${o.siteUrl}/pt-br/trocas-e-devolucoes`;
  // Decreto 7.962/2013 art. 4º: confirm the order and keep the contract terms at hand; CDC art. 49
  const rights = c.rights
    ? `Você pode desistir da compra em até 7 dias corridos após receber o produto, com reembolso integral (art. 49 do CDC). Termos de venda: ${termsUrl} · Trocas e devoluções: ${returnsUrl}`
    : "";
  const seller = customer && o.seller ? o.seller : "";
  const rows = c.showItems
    ? o.items.map((i) => `<tr><td style="padding:6px 0">${i.quantity}× ${esc(i.name)}</td><td style="padding:6px 0;text-align:right">${esc(money(i.lineTotalMinor))}</td></tr>`).join("") +
      `<tr><td style="padding:10px 0 0;border-top:1px solid #e5e5e5;font-weight:600">Total</td><td style="padding:10px 0 0;border-top:1px solid #e5e5e5;text-align:right;font-weight:600">${esc(money(o.totalMinor))}</td></tr>`
    : "";
  const tracking = c.showTracking
    ? o.items
        .filter((i) => i.trackingCode)
        .map((i) => `<tr><td style="padding:6px 0">${esc(i.name)}</td><td style="padding:6px 0;text-align:right;font-family:monospace">${esc(i.trackingCarrier ?? "")} ${i.trackingUrl ? `<a href="${esc(i.trackingUrl)}" style="color:#000">${esc(i.trackingCode!)}</a>` : esc(i.trackingCode!)}</td></tr>`)
        .join("")
    : "";
  const button = c.cta ? `<p style="margin:28px 0 0"><a href="${esc(c.cta.href)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600">${esc(c.cta.label)}</a></p>` : "";
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f7f7;font-family:Arial,Helvetica,sans-serif;color:#000">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e5e5e5;border-radius:8px"><tr><td style="padding:32px">
<p style="margin:0 0 24px;font-weight:700;letter-spacing:2px">NEXTECH</p>
<p style="margin:0;font-size:16px;line-height:1.5">${esc(c.lead)}</p>
${rows || tracking ? `<table role="presentation" width="100%" style="margin-top:20px;font-size:14px">${rows}${tracking}</table>` : ""}
${button}
${rights ? `<p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:#222222">Você pode desistir da compra em até 7 dias corridos após receber o produto, com reembolso integral (art. 49 do CDC). <a href="${esc(termsUrl)}" style="color:#000">Termos de venda</a> · <a href="${esc(returnsUrl)}" style="color:#000">Trocas e devoluções</a></p>` : ""}
<p style="margin:32px 0 0;font-size:12px;color:#777777">Você recebeu este e-mail por causa de um pedido na NEXTECH.${seller ? `<br>${esc(seller)}` : ""}</p>
</td></tr></table></td></tr></table></body></html>`;
  const lines = [
    c.lead,
    ...(c.showItems ? o.items.map((i) => `${i.quantity}x ${i.name} — ${money(i.lineTotalMinor)}`).concat(`Total: ${money(o.totalMinor)}`) : []),
    ...(c.showTracking ? o.items.filter((i) => i.trackingCode).map((i) => `${i.name}: ${i.trackingCarrier ?? ""} ${i.trackingCode}`) : []),
    ...(c.cta ? [`${c.cta.label}: ${c.cta.href}`] : []),
    ...(rights ? ["", rights] : []),
    ...(seller ? ["", seller] : []),
  ];
  return { subject: c.subject, html, text: lines.join("\n") };
}
