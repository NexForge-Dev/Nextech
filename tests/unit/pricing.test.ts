import { describe, it, expect } from "vitest";
import { provenPrevious, discountPercent, displayPrice, bestOffer, priceSummary, type OfferForPricing } from "@/lib/domain/pricing";

const NOW = new Date("2026-10-31T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400_000).toISOString();
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

function offer(p: Partial<OfferForPricing> = {}): OfferForPricing {
  return {
    id: "o1", market: "BR", currency: "BRL", active: true, policy: "show",
    priceMinor: 80000, priceUpdatedAt: daysAgo(1), previousPriceMinor: null, previousVerified: false,
    priceSource: "manual", requiresFreshIntegration: false, history: [], ...p,
  };
}

describe("discountPercent", () => {
  it("rounds to an integer", () => {
    expect(discountPercent(80000, 100000)).toBe(20);
    expect(discountPercent(99990, 100000)).toBe(0);
  });
});

describe("provenPrevious", () => {
  it("accepts a higher history price within 90 days", () => {
    expect(provenPrevious(offer({ history: [{ priceMinor: 100000, observedAt: daysAgo(30) }] }), NOW)).toBe(100000);
  });
  it("rejects a history price older than 90 days", () => {
    expect(provenPrevious(offer({ history: [{ priceMinor: 100000, observedAt: daysAgo(91) }] }), NOW)).toBeNull();
  });
  it("rejects a lower history price", () => {
    expect(provenPrevious(offer({ history: [{ priceMinor: 70000, observedAt: daysAgo(10) }] }), NOW)).toBeNull();
  });
  it("ignores history observed after the current price was set", () => {
    expect(provenPrevious(offer({ priceUpdatedAt: daysAgo(5), history: [{ priceMinor: 100000, observedAt: daysAgo(2) }] }), NOW)).toBeNull();
  });
  it("uses the most recent qualifying history entry", () => {
    const o = offer({ history: [{ priceMinor: 90000, observedAt: daysAgo(10) }, { priceMinor: 120000, observedAt: daysAgo(40) }] });
    expect(provenPrevious(o, NOW)).toBe(90000);
  });
  it("rejects an unverified manual previous price", () => {
    expect(provenPrevious(offer({ previousPriceMinor: 100000, previousVerified: false }), NOW)).toBeNull();
  });
  it("accepts a verified manual previous price", () => {
    expect(provenPrevious(offer({ previousPriceMinor: 100000, previousVerified: true }), NOW)).toBe(100000);
  });
  it("never proves a previous price for a link_only offer", () => {
    expect(provenPrevious(offer({ policy: "link_only", previousPriceMinor: 100000, previousVerified: true }), NOW)).toBeNull();
  });
});

describe("displayPrice", () => {
  it("hides link_only prices", () => expect(displayPrice(offer({ policy: "link_only" }), NOW)).toBeNull());
  it("hides inactive offers", () => expect(displayPrice(offer({ active: false }), NOW)).toBeNull());
  it("hides missing prices", () => expect(displayPrice(offer({ priceMinor: null }), NOW)).toBeNull());
  it("shows a normal price", () => expect(displayPrice(offer(), NOW)).toBe(80000));
  it("staleIntegrationPrice: hides fresh-integration prices older than 24 h", () => {
    expect(displayPrice(offer({ requiresFreshIntegration: true, priceSource: "integration", priceUpdatedAt: hoursAgo(25) }), NOW)).toBeNull();
  });
  it("staleIntegrationPrice: shows them within 24 h", () => {
    expect(displayPrice(offer({ requiresFreshIntegration: true, priceSource: "integration", priceUpdatedAt: hoursAgo(2) }), NOW)).toBe(80000);
  });
  it("staleIntegrationPrice: hides manual prices on offers that require integration", () => {
    expect(displayPrice(offer({ requiresFreshIntegration: true, priceSource: "manual", priceUpdatedAt: hoursAgo(1) }), NOW)).toBeNull();
  });
});

describe("bestOffer", () => {
  it("picks the cheapest active priced offer in the market", () => {
    const offers = [offer({ id: "a", priceMinor: 7000 }), offer({ id: "b", priceMinor: 5000 }), offer({ id: "c", priceMinor: 1000, market: "PT", currency: "EUR" })];
    expect(bestOffer(offers, "BR", NOW)?.id).toBe("b");
  });
  it("falls back to an active link_only offer", () => {
    expect(bestOffer([offer({ id: "amz", policy: "link_only" })], "BR", NOW)?.id).toBe("amz");
  });
  it("breaks ties by the most recent update", () => {
    const offers = [offer({ id: "old", priceMinor: 5000, priceUpdatedAt: daysAgo(5) }), offer({ id: "new", priceMinor: 5000, priceUpdatedAt: daysAgo(1) })];
    expect(bestOffer(offers, "BR", NOW)?.id).toBe("new");
  });
  it("returns null without offers in the market", () => expect(bestOffer([offer({ market: "PT" })], "BR", NOW)).toBeNull());
});

describe("priceSummary", () => {
  it("summarizes multiple priced offers", () => {
    const s = priceSummary([offer({ id: "a", priceMinor: 5000 }), offer({ id: "b", priceMinor: 7000 })], "BR", NOW);
    expect(s).toMatchObject({ kind: "price", fromMinor: 5000, currency: "BRL", multiple: true, previousMinor: null, discount: null });
  });
  it("includes a proven discount of the best offer", () => {
    const s = priceSummary([offer({ priceMinor: 80000, previousPriceMinor: 100000, previousVerified: true })], "BR", NOW);
    expect(s).toMatchObject({ kind: "price", fromMinor: 80000, multiple: false, previousMinor: 100000, discount: 20 });
  });
  it("is link_only when only link_only offers exist", () => {
    expect(priceSummary([offer({ policy: "link_only" })], "BR", NOW)).toEqual({ kind: "link_only" });
  });
  it("is unavailable with the markets that do have offers", () => {
    expect(priceSummary([offer({ market: "PT", currency: "EUR" })], "BR", NOW)).toEqual({ kind: "unavailable", availableMarkets: ["PT"] });
  });
  it("ignores inactive offers when listing available markets", () => {
    expect(priceSummary([offer({ market: "PT", active: false })], "BR", NOW)).toEqual({ kind: "unavailable", availableMarkets: [] });
  });
});
