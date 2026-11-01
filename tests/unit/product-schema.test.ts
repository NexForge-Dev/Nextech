import { describe, it, expect } from "vitest";
import { productInputSchema, validateOfferUrls } from "@/lib/admin/schemas/product";

const S1 = "11111111-1111-4111-8111-111111111111";
const C1 = "22222222-2222-4222-8222-222222222222";

const offer = { storeId: S1, networkId: null, market: "BR", currency: "BRL", originalUrl: "https://loja.com/p/1", affiliateUrl: "", price: "199,90", previousPrice: "", previousVerified: false, previousEvidence: "", externalId: "", active: true };
const base = {
  slug: "fone-x", brandId: null, categoryId: C1, tags: ["audio"], status: "draft", featured: false, sku: "", externalId: "",
  rating: "", ratingCount: "", ratingSource: "", specs: [],
  translations: { "pt-BR": { name: "Fone X", shortDescription: "", descriptionMd: "", specs: [] } },
  images: [], offers: [offer],
};

describe("productInputSchema", () => {
  it("accepts a valid product and parses prices to minor units", () => {
    const r = productInputSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.offers[0].priceMinor).toBe(19990);
  });
  it("rejects an http original URL on the right field", () => {
    const r = productInputSchema.safeParse({ ...base, offers: [{ ...offer, originalUrl: "http://loja.com/p/1" }] });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues.some((i) => i.path.join(".") === "offers.0.originalUrl")).toBe(true);
  });
  it("requires evidence when the previous price is marked verified", () => {
    const r = productInputSchema.safeParse({ ...base, offers: [{ ...offer, previousPrice: "299,90", previousVerified: true }] });
    expect(!r.success && r.error.issues.some((i) => i.path.join(".") === "offers.0.previousEvidence")).toBe(true);
  });
  it("rejects two main images", () => {
    const r = productInputSchema.safeParse({ ...base, images: [{ path: "a.png", alt: "", isMain: true }, { path: "b.png", alt: "", isMain: true }] });
    expect(r.success).toBe(false);
  });
  it("requires a rating source with a rating", () => {
    const r = productInputSchema.safeParse({ ...base, rating: "4,5" });
    expect(!r.success && r.error.issues.some((i) => i.path.join(".") === "ratingSource")).toBe(true);
  });
  it("rejects an invalid price", () => {
    expect(productInputSchema.safeParse({ ...base, offers: [{ ...offer, price: "abc" }] }).success).toBe(false);
  });
});

describe("validateOfferUrls", () => {
  it("reports hosts not registered for the store", () => {
    const errs = validateOfferUrls([{ storeId: S1, originalUrl: "https://outra.com/x", affiliateUrl: null }], new Map([[S1, { name: "Loja", domains: ["loja.com"] }]]));
    expect(errs["offers.0.originalUrl"]?.[0]).toContain('Domínio "outra.com" não está cadastrado na loja Loja');
  });
  it("accepts subdomains of registered domains", () => {
    const errs = validateOfferUrls([{ storeId: S1, originalUrl: "https://www.loja.com/x", affiliateUrl: "https://loja.com/x?aff=1" }], new Map([[S1, { name: "Loja", domains: ["loja.com"] }]]));
    expect(errs).toEqual({});
  });
});
