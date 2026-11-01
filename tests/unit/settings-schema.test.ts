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
