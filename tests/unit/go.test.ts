import { describe, it, expect } from "vitest";
import { resolveGo, type GoRepo, type GoOffer } from "@/lib/tracking/go";

const P = "11111111-1111-4111-8111-111111111111";
const O1 = "22222222-2222-4222-8222-222222222222";
const O2 = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-10-31T12:00:00Z");
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function offer(p: Partial<GoOffer> = {}): GoOffer {
  return {
    id: O1, market: "BR", currency: "BRL", active: true, policy: "show", priceMinor: 1000, priceUpdatedAt: NOW.toISOString(),
    previousPriceMinor: null, previousVerified: false, priceSource: "manual", requiresFreshIntegration: false, history: [],
    storeId: "s1", networkId: "n1", affiliateUrl: "https://www.loja.com/p/1?aff=x", originalUrl: "https://loja.com/p/1", ...p,
  };
}

function repo(over: Partial<GoRepo> = {}): GoRepo {
  return {
    getProduct: async () => ({ id: P, published: true, saleMode: "affiliate", modeEnabled: true, offers: [offer(), offer({ id: O2, priceMinor: 900, affiliateUrl: "https://loja.com/p/2" })] }),
    getStoreDomains: async () => ["loja.com"],
    getNetwork: async () => ({ subidParam: null }),
    getCampaignId: async () => null,
    ...over,
  };
}

const input = (p: Partial<Parameters<typeof resolveGo>[0]> = {}) => ({ productId: P, market: "BR", ua: CHROME, consent: null, now: NOW, ...p });

describe("resolveGo — business models", () => {
  it("does not redirect while affiliates are switched off", async () => {
    const r = await resolveGo(input(), repo({ getProduct: async () => ({ id: P, published: true, saleMode: "affiliate", modeEnabled: false, offers: [offer()] }) }));
    expect(r).toEqual({ status: 404, reason: "mode_disabled" });
  });
  it("sends own-store products to their product page instead of a partner", async () => {
    const r = await resolveGo(input(), repo({ getProduct: async () => ({ id: P, published: true, saleMode: "own", modeEnabled: true, slug: "fone-x", offers: [offer()] }) }));
    expect(r).toEqual({ status: 404, reason: "own_product", slug: "fone-x" });
  });
});

describe("resolveGo", () => {
  it("404s an unpublished product", async () => {
    const r = await resolveGo(input(), repo({ getProduct: async () => ({ id: P, published: false, offers: [offer()] }) }));
    expect(r.status).toBe(404);
  });
  it("404s a missing product", async () => expect((await resolveGo(input(), repo({ getProduct: async () => null }))).status).toBe(404));
  it("404s a non-UUID id without touching the repo", async () => {
    let called = false;
    const r = await resolveGo(input({ productId: "abc" }), repo({ getProduct: async () => ((called = true), null) }));
    expect(r.status).toBe(404);
    expect(called).toBe(false);
  });
  it("404s (never redirects) when the destination host is not allowed", async () => {
    const r = await resolveGo(input({ offerId: O1 }), repo({ getProduct: async () => ({ id: P, published: true, offers: [offer({ affiliateUrl: "https://evil.com/x" })] }) }));
    expect(r.status).toBe(404);
  });
  it("uses the requested offer when it belongs to the product", async () => {
    const r = await resolveGo(input({ offerId: O1 }), repo());
    expect(r.status === 302 && r.location).toBe("https://www.loja.com/p/1?aff=x");
  });
  it("falls back to the best offer for an offer of another product", async () => {
    const r = await resolveGo(input({ offerId: OTHER }), repo());
    expect(r.status === 302 && r.click.link_id).toBe(O2);
  });
  it("falls back to the original URL without an affiliate URL", async () => {
    const r = await resolveGo(input({ offerId: O1 }), repo({ getProduct: async () => ({ id: P, published: true, offers: [offer({ affiliateUrl: null })] }) }));
    expect(r.status === 302 && r.location).toBe("https://loja.com/p/1");
  });
  it("uses an offer in another market when the visitor's market has none", async () => {
    const r = await resolveGo(input({ market: "US" }), repo());
    expect(r.status).toBe(302);
  });
  it("appends the network sub-id with the click id", async () => {
    const r = await resolveGo(input({ offerId: O1 }), repo({ getNetwork: async () => ({ subidParam: "clickref" }) }));
    if (r.status !== 302) throw new Error("expected redirect");
    expect(r.location).toContain(`clickref=${r.click.id}`);
  });
  it("stores no referrer or session without consent", async () => {
    const r = await resolveGo(input({ referrerPath: "/pt-br/produto/x", sessionId: "sid" }), repo());
    if (r.status !== 302) throw new Error("expected redirect");
    expect(r.click.referrer_path).toBeNull();
    expect(r.click.session_id).toBeNull();
  });
  it("stores referrer and session with analytics consent", async () => {
    const r = await resolveGo(input({ referrerPath: "/pt-br/produto/x", sessionId: "sid", consent: { v: 1, analytics: true, marketing: false, decidedAt: NOW.toISOString() } }), repo());
    if (r.status !== 302) throw new Error("expected redirect");
    expect(r.click.referrer_path).toBe("/pt-br/produto/x");
    expect(r.click.session_id).toBe("sid");
  });
  it("flags bots but still redirects", async () => {
    const r = await resolveGo(input({ ua: "Mozilla/5.0 (compatible; Googlebot/2.1)" }), repo());
    expect(r.status).toBe(302);
    expect(r.status === 302 && r.click.is_bot).toBe(true);
  });
  it("maps a campaign slug to its id", async () => {
    const r = await resolveGo(input({ campaign: "black-friday" }), repo({ getCampaignId: async (s) => (s === "black-friday" ? "c1" : null) }));
    expect(r.status === 302 && r.click.campaign_id).toBe("c1");
  });
});
