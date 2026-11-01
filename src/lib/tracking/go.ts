import type { Consent } from "@/lib/domain/consent";
import type { MarketCode } from "@/lib/domain/markets";
import { bestOffer, type OfferForPricing } from "@/lib/domain/pricing";
import { appendParam, validateExternalUrl } from "@/lib/domain/url-guard";
import { isBot } from "./bots";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type GoOffer = OfferForPricing & { storeId: string; networkId: string | null; affiliateUrl: string | null; originalUrl: string };

export type GoRepo = {
  getProduct(id: string): Promise<{ id: string; published: boolean; offers: GoOffer[] } | null>;
  getStoreDomains(storeId: string): Promise<string[]>;
  getNetwork(id: string): Promise<{ subidParam: string | null } | null>;
  getCampaignId(slug: string): Promise<string | null>;
};

export type ClickRow = {
  id: string;
  occurred_at: string;
  product_id: string;
  link_id: string;
  store_id: string;
  network_id: string | null;
  campaign_id: string | null;
  locale: string | null;
  market: string;
  session_id: string | null;
  referrer_path: string | null;
  is_bot: boolean;
};

export type GoInput = {
  productId: string;
  offerId?: string | null;
  market: MarketCode;
  campaign?: string | null;
  locale?: string | null;
  ua: string | null;
  consent: Consent | null;
  referrerPath?: string | null;
  sessionId?: string | null;
  now?: Date;
};

export type GoResult = { status: 302; location: string; click: ClickRow } | { status: 404; reason: string; blockedHost?: string };

/** Decide where /go/[productId] redirects and what click to record. Pure apart from the repo. */
export async function resolveGo(input: GoInput, repo: GoRepo): Promise<GoResult> {
  const now = input.now ?? new Date();
  if (!UUID.test(input.productId)) return { status: 404, reason: "invalid_id" };
  const product = await repo.getProduct(input.productId);
  if (!product || !product.published) return { status: 404, reason: "not_found" };

  const active = product.offers.filter((o) => o.active);
  const requested = input.offerId && UUID.test(input.offerId) ? active.find((o) => o.id === input.offerId) : undefined;
  let offer: GoOffer | null | undefined = requested ?? bestOffer(active, input.market, now);
  if (!offer) {
    // no offer for the visitor's market: best offer in any market where one exists
    for (const m of [...new Set(active.map((o) => o.market))]) {
      offer = bestOffer(active, m, now);
      if (offer) break;
    }
  }
  if (!offer) return { status: 404, reason: "no_offer" };

  const destination = offer.affiliateUrl || offer.originalUrl;
  const domains = await repo.getStoreDomains(offer.storeId);
  const check = validateExternalUrl(destination, domains);
  if (!check.ok) return { status: 404, reason: `blocked_${check.reason}`, blockedHost: check.host };

  const clickId = crypto.randomUUID();
  let location = check.url.toString();
  if (offer.networkId) {
    const network = await repo.getNetwork(offer.networkId);
    if (network?.subidParam) location = appendParam(location, network.subidParam, clickId);
  }
  const campaignId = input.campaign && SLUG.test(input.campaign) ? await repo.getCampaignId(input.campaign) : null;
  const consented = input.consent?.analytics === true;

  return {
    status: 302,
    location,
    click: {
      id: clickId,
      occurred_at: now.toISOString(),
      product_id: product.id,
      link_id: offer.id,
      store_id: offer.storeId,
      network_id: offer.networkId,
      campaign_id: campaignId,
      locale: input.locale ?? null,
      market: input.market,
      session_id: consented ? (input.sessionId ?? null) : null,
      referrer_path: consented ? (input.referrerPath ?? null) : null,
      is_bot: isBot(input.ua),
    },
  };
}
