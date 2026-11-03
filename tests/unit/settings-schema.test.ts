import { describe, it, expect } from "vitest";
import { settingsSchema } from "@/lib/admin/schemas/settings";

const base = {
  storeName: "NEXTECH",
  contactEmail: "contato@nextech.com",
  logoPath: null,
  faviconPath: null,
  heroImage: null,
  institutional: {},
  socials: { instagram: "https://instagram.com/nextech" },
  seo: { "pt-BR": { title: "NEXTECH", description: "" } },
  analytics: { ga4: "", plausible: "" },
  cookieTexts: {},
  legal: { company_name: "", tax_id: "", address: "" },
  priceStaleDays: 14,
};

describe("settings schema", () => {
  it("accepts valid settings", () => expect(settingsSchema.safeParse(base).success).toBe(true));
  it("rejects a Universal Analytics id", () => expect(settingsSchema.safeParse({ ...base, analytics: { ga4: "UA-123", plausible: "" } }).success).toBe(false));
  it("accepts a GA4 id", () => expect(settingsSchema.safeParse({ ...base, analytics: { ga4: "G-ABC123", plausible: "" } }).success).toBe(true));
  it("rejects a non-https social URL", () => expect(settingsSchema.safeParse({ ...base, socials: { instagram: "http://instagram.com/x" } }).success).toBe(false));
  it("rejects an invalid contact email", () => expect(settingsSchema.safeParse({ ...base, contactEmail: "nope" }).success).toBe(false));
  it("requires a store name", () => expect(settingsSchema.safeParse({ ...base, storeName: "" }).success).toBe(false));
  it("bounds the stale threshold", () => expect(settingsSchema.safeParse({ ...base, priceStaleDays: 0 }).success).toBe(false));
});

describe("settings schema — business models", () => {
  it("defaults business models when absent", () => {
    const r = settingsSchema.safeParse(base);
    expect(r.success && r.data.businessModels).toEqual({ ownStore: true, ownStock: false, dropshipping: true, affiliates: false, payments: { card: true, boleto: true, pix: false } });
  });
  it("closes the checkout when both own modes are off", () => {
    const r = settingsSchema.safeParse({ ...base, businessModels: { ownStore: true, ownStock: false, dropshipping: false, affiliates: true, payments: { card: false, boleto: false, pix: false } } });
    expect(r.success && r.data.businessModels.ownStore).toBe(false);
  });
  it("accepts both models enabled", () => {
    const r = settingsSchema.safeParse({ ...base, businessModels: { ownStore: true, affiliates: true, payments: { card: true, boleto: false, pix: false } } });
    expect(r.success).toBe(true);
  });
  it("requires a payment method while the own store is on", () => {
    const r = settingsSchema.safeParse({ ...base, businessModels: { ownStore: true, affiliates: false, payments: { card: false, boleto: false, pix: false } } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message)).toContain("Ative ao menos uma forma de pagamento.");
  });
  it("allows no payment method when the own store is off", () => {
    const r = settingsSchema.safeParse({ ...base, businessModels: { ownStore: false, affiliates: true, payments: { card: false, boleto: false, pix: false } } });
    expect(r.success).toBe(true);
  });
});
