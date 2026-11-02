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

describe("productInputSchema — own store", () => {
  const SUP1 = "33333333-3333-4333-8333-333333333333";
  const SUP2 = "44444444-4444-4444-8444-444444444444";
  const sale = { price: "249,90", compareAt: "299,90", pixDiscountPct: "5", available: true, deliveryMinDays: 3, deliveryMaxDays: 7 };
  const own = { ...base, offers: [], saleMode: "own", sale, suppliers: [{ supplierId: SUP1, url: "https://www.amazon.com.br/dp/X", cost: "165,00", isPrimary: true, notes: "" }] };
  const issue = (r: ReturnType<typeof productInputSchema.safeParse>, path: string) => (!r.success ? r.error.issues.find((i) => i.path.join(".") === path)?.message : undefined);

  it("defaults existing products to affiliate mode", () => {
    const r = productInputSchema.safeParse(base);
    expect(r.success && r.data.saleMode).toBe("affiliate");
  });
  it("accepts an own product without offers and parses money to centavos", () => {
    const r = productInputSchema.safeParse(own);
    expect(r.success).toBe(true);
    expect(r.success && r.data.sale).toEqual({ priceMinor: 24990, compareAtMinor: 29990, pixDiscountPct: 5, available: true, deliveryMinDays: 3, deliveryMaxDays: 7 });
    expect(r.success && r.data.suppliers[0]).toMatchObject({ supplierId: SUP1, costMinor: 16500, isPrimary: true });
  });
  it("requires a sale price in own mode", () => {
    expect(issue(productInputSchema.safeParse({ ...own, sale: { ...sale, price: "" } }), "sale.price")).toBe("Informe o preço de venda.");
  });
  it("rejects a 'from' price not above the sale price", () => {
    expect(issue(productInputSchema.safeParse({ ...own, sale: { ...sale, compareAt: "249,90" } }), "sale.compareAt")).toBe("O preço “de” precisa ser maior que o preço de venda.");
  });
  it("rejects two primary suppliers", () => {
    const r = productInputSchema.safeParse({ ...own, suppliers: [own.suppliers[0], { ...own.suppliers[0], supplierId: SUP2 }] });
    expect(issue(r, "suppliers")).toBe("Marque no máximo um fornecedor principal.");
  });
  it("rejects a non-https supplier link", () => {
    expect(issue(productInputSchema.safeParse({ ...own, suppliers: [{ ...own.suppliers[0], url: "http://x.com" }] }), "suppliers.0.url")).toBe("Use um endereço https:// válido.");
  });
  it("rejects a delivery window that ends before it starts", () => {
    expect(issue(productInputSchema.safeParse({ ...own, sale: { ...sale, deliveryMinDays: 8, deliveryMaxDays: 3 } }), "sale.deliveryMaxDays")).toBe("O prazo máximo precisa ser maior ou igual ao mínimo.");
  });
});
