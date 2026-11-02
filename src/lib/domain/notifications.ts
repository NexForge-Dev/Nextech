export type NotificationKind = "stale" | "ending" | "starting" | "sync_failed" | "messages" | "no_offer" | "orders_to_buy" | "returns_open";

export type AdminNotification = { key: string; kind: NotificationKind; title: string; href: string; at: string };

export type NotificationInput = {
  now: Date;
  staleDays: number;
  offers: { id: string; productId: string; productName: string; priceUpdatedAt: string | null; policy: "show" | "link_only"; hasPrice: boolean }[];
  schedules: { kind: "promotion" | "banner" | "campaign"; id: string; name: string; startsAt: string | null; endsAt: string | null }[];
  failedSyncs: { networkId: string; networkName: string; at: string }[];
  unhandledMessages: number;
  productsWithoutOffer: { id: string; name: string }[];
  /** Own store: paid orders still waiting for the supplier purchase, and open return/support requests. */
  ordersToBuy?: number;
  openReturns?: number;
};

const H48 = 48 * 3_600_000;
const KIND_LABEL = { promotion: "Oferta", banner: "Banner", campaign: "Campanha" } as const;
const HREF = { promotion: "/admin/ofertas", banner: "/admin/banners", campaign: "/admin/campanhas" } as const;

/** Notifications derived from real data (nothing is fabricated). Keys are stable so read state persists. */
export function computeNotifications(i: NotificationInput): AdminNotification[] {
  const now = i.now.getTime();
  const out: AdminNotification[] = [];
  const staleMs = i.staleDays * 86_400_000;

  for (const o of i.offers) {
    if (o.policy === "link_only" || !o.hasPrice || !o.priceUpdatedAt) continue;
    if (now - new Date(o.priceUpdatedAt).getTime() > staleMs) {
      out.push({ key: `stale:${o.id}:${o.priceUpdatedAt}`, kind: "stale", title: `Preço desatualizado há mais de ${i.staleDays} dias: ${o.productName}`, href: `/admin/produtos/${o.productId}`, at: o.priceUpdatedAt });
    }
  }
  for (const s of i.schedules) {
    if (s.startsAt) {
      const t = new Date(s.startsAt).getTime();
      if (t > now && t - now <= H48) out.push({ key: `starting:${s.kind}:${s.id}:${s.startsAt}`, kind: "starting", title: `${KIND_LABEL[s.kind]} começa em breve: ${s.name}`, href: `${HREF[s.kind]}/${s.id}`, at: s.startsAt });
    }
    if (s.endsAt) {
      const t = new Date(s.endsAt).getTime();
      if (t > now && t - now <= H48) out.push({ key: `ending:${s.kind}:${s.id}:${s.endsAt}`, kind: "ending", title: `${KIND_LABEL[s.kind]} termina em breve: ${s.name}`, href: `${HREF[s.kind]}/${s.id}`, at: s.endsAt });
    }
  }
  for (const f of i.failedSyncs) {
    out.push({ key: `sync:${f.networkId}:${f.at}`, kind: "sync_failed", title: `Falha na sincronização: ${f.networkName}`, href: `/admin/afiliados/${f.networkId}`, at: f.at });
  }
  if (i.unhandledMessages > 0) {
    out.push({ key: `messages:${i.unhandledMessages}`, kind: "messages", title: `${i.unhandledMessages} mensagem(ns) de contato sem resposta`, href: "/admin/clientes/mensagens", at: i.now.toISOString() });
  }
  if (i.ordersToBuy) {
    out.push({ key: `orders_to_buy:${i.ordersToBuy}`, kind: "orders_to_buy", title: `${i.ordersToBuy} pedido(s) pago(s) aguardando compra no fornecedor`, href: "/admin/pedidos?status=awaiting_supplier", at: i.now.toISOString() });
  }
  if (i.openReturns) {
    out.push({ key: `returns_open:${i.openReturns}`, kind: "returns_open", title: `${i.openReturns} solicitação(ões) de devolução/suporte em aberto`, href: "/admin/pedidos/devolucoes", at: i.now.toISOString() });
  }
  for (const p of i.productsWithoutOffer) {
    out.push({ key: `no_offer:${p.id}`, kind: "no_offer", title: `Produto publicado sem oferta ativa: ${p.name}`, href: `/admin/produtos/${p.id}`, at: i.now.toISOString() });
  }
  return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
