import { describe, it, expect } from "vitest";
import { productJsonLd, type JsonLdProductInput } from "@/lib/seo/json-ld";

const NOW = new Date("2026-10-31T12:00:00Z");
const base: JsonLdProductInput = {
  name: "Fone X",
  description: "Um fone",
  brand: "Marca",
  sku: "SKU1",
  images: ["https://cdn/x.png"],
  rating: { value: 4.5, count: 120 },
  offers: [],
};

const offer = (p: Partial<JsonLdProductInput["offers"][number]> = {}) => ({
  id: "o1", market: "BR", currency: "BRL", active: true, policy: "show" as const, priceMinor: 129990,
  priceUpdatedAt: NOW.toISOString(), previousPriceMinor: null, previousVerified: false, priceSource: "manual" as const,
  requiresFreshIntegration: false, history: [], storeName: "Loja", url: "https://site/go/1", ...p,
});

describe("productJsonLd", () => {
  it("omits price and rating for link_only-only products", () => {
    const ld = productJsonLd({ ...base, offers: [offer({ policy: "link_only" })] }, "https://site/p", NOW, false);
    const json = JSON.stringify(ld);
    expect(json).not.toContain('"price"');
    expect(json).not.toContain("aggregateRating");
  });
  it("emits a priced offer with decimal price and currency", () => {
    const ld = productJsonLd({ ...base, offers: [offer()] }, "https://site/p", NOW, true) as { offers: { price: string; priceCurrency: string }[]; aggregateRating?: unknown };
    expect(ld.offers[0].price).toBe("1299.90");
    expect(ld.offers[0].priceCurrency).toBe("BRL");
    expect(ld.aggregateRating).toBeDefined();
  });
  it("omits aggregateRating when the rating is not shown", () => {
    const ld = productJsonLd({ ...base, offers: [offer()] }, "https://site/p", NOW, false);
    expect(JSON.stringify(ld)).not.toContain("aggregateRating");
  });
});
