import { describe, it, expect } from "vitest";
import { storeSchema, normalizeDomain } from "@/lib/admin/schemas/store";
import { categorySchema } from "@/lib/admin/schemas/category";
import { brandSchema } from "@/lib/admin/schemas/brand";

const store = { name: "Amazon BR", slug: "amazon-br", officialUrl: "https://www.amazon.com.br", description: "", networkId: null, markets: ["BR"], priceDisplayPolicy: "inherit", domains: ["amazon.com.br"], active: true, logoPath: null };

describe("store schema", () => {
  it("normalizes domains", () => expect(normalizeDomain("WWW.Amazon.com.br")).toBe("amazon.com.br"));
  it("normalizes domains in the payload", () => {
    const r = storeSchema.safeParse({ ...store, domains: ["WWW.Amazon.com.br"] });
    expect(r.success && r.data.domains).toEqual(["amazon.com.br"]);
  });
  it("rejects a domain without TLD", () => expect(storeSchema.safeParse({ ...store, domains: ["amazon"] }).success).toBe(false));
  it("rejects a URL as domain", () => expect(storeSchema.safeParse({ ...store, domains: ["https://amazon.com.br"] }).success).toBe(false));
  it("requires https official URL", () => expect(storeSchema.safeParse({ ...store, officialUrl: "http://amazon.com.br" }).success).toBe(false));
  it("requires at least one domain", () => expect(storeSchema.safeParse({ ...store, domains: [] }).success).toBe(false));
});

describe("category schema", () => {
  const cat = { slug: "games", icon: "Gamepad2", imagePath: null, sortOrder: 10, active: true, translations: { "pt-BR": { name: "Games", description: "" } } };
  it("accepts a valid category", () => expect(categorySchema.safeParse(cat).success).toBe(true));
  it("requires the pt-BR name", () => expect(categorySchema.safeParse({ ...cat, translations: { en: { name: "Games" } } }).success).toBe(false));
  it("rejects an unknown icon", () => expect(categorySchema.safeParse({ ...cat, icon: "Skull" }).success).toBe(false));
  it("rejects an invalid slug", () => expect(categorySchema.safeParse({ ...cat, slug: "Games!" }).success).toBe(false));
});

describe("brand schema", () => {
  it("requires a name", () => expect(brandSchema.safeParse({ name: "", slug: "x", logoPath: null, active: true }).success).toBe(false));
});
