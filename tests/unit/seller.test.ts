import { describe, it, expect } from "vitest";
import { DEFAULT_CONTACT_EMAIL, isSellerIdentified, resolveContactEmail, sellerContactLine, sellerIdentityGaps, sellerIdentityParts } from "@/lib/domain/seller";
import { ownStoreReadiness } from "@/lib/admin/launch-readiness";

const full = { company_name: "Loja X LTDA", tax_id: "12.345.678/0001-90", address: "Rua A, 1 — São Paulo/SP" };
const env = {
  STRIPE_SECRET_KEY: "x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "x", STRIPE_WEBHOOK_SECRET: "x",
  RESEND_API_KEY: "x", EMAIL_FROM: "x", OWNER_ALERT_EMAIL: "x", CRON_SECRET: "x",
  NEXT_PUBLIC_SITE_URL: "https://loja.example", NODE_ENV: "production",
};

describe("seller identity", () => {
  it("reports every missing field", () => {
    expect(sellerIdentityGaps({ company_name: " ", tax_id: "", address: "" }, "")).toEqual(["company_name", "tax_id", "address", "contact_email"]);
    expect(sellerIdentityGaps(full, "sac@loja.example")).toEqual([]);
  });
  it("joins only the fields that are set and labels the CNPJ once", () => {
    expect(sellerIdentityParts(full)).toEqual(["Loja X LTDA", "CNPJ 12.345.678/0001-90", "Rua A, 1 — São Paulo/SP"]);
    expect(sellerIdentityParts({ ...full, tax_id: "CNPJ 12.345.678/0001-90" })[1]).toBe("CNPJ 12.345.678/0001-90");
    expect(sellerIdentityParts({ company_name: "", tax_id: "", address: "Rua B" })).toEqual(["Rua B"]);
    expect(sellerIdentityParts(null)).toEqual([]);
  });
  it("labels 11 digits as CPF, and never relabels", () => {
    expect(sellerIdentityParts({ tax_id: "123.456.789-09" })).toEqual(["CPF 123.456.789-09"]);
    expect(sellerIdentityParts({ tax_id: "12345678909" })).toEqual(["CPF 12345678909"]);
    expect(sellerIdentityParts({ tax_id: "CPF 123.456.789-09" })).toEqual(["CPF 123.456.789-09"]);
    expect(sellerIdentityParts({ tax_id: "123" }, "NIF")).toEqual(["NIF 123"]);
  });
  it("the contact defaults only when the setting is blank", () => {
    expect(resolveContactEmail("")).toBe(DEFAULT_CONTACT_EMAIL);
    expect(resolveContactEmail("  ")).toBe(DEFAULT_CONTACT_EMAIL);
    expect(resolveContactEmail(null)).toBe(DEFAULT_CONTACT_EMAIL);
    expect(resolveContactEmail(" sac@loja.example ")).toBe("sac@loja.example");
    expect(DEFAULT_CONTACT_EMAIL).toBe("nexforge.d4v29@gmail.com");
  });
  it("sales need name, tax id and address; the default e-mail does not fill the gap", () => {
    expect(isSellerIdentified(full)).toBe(true);
    expect(isSellerIdentified(null)).toBe(false);
    expect(isSellerIdentified({ ...full, company_name: "  " })).toBe(false);
    expect(isSellerIdentified({ ...full, tax_id: "" })).toBe(false);
    expect(isSellerIdentified({ ...full, address: "" })).toBe(false);
  });
  it("the seller line always carries the contact", () => {
    expect(sellerContactLine(null, "")).toBe(DEFAULT_CONTACT_EMAIL);
    expect(sellerContactLine(full, "sac@loja.example")).toBe("Loja X LTDA · CNPJ 12.345.678/0001-90 · Rua A, 1 — São Paulo/SP · sac@loja.example");
  });
});

describe("own-store launch readiness", () => {
  it("is clean when everything is configured", () => {
    expect(ownStoreReadiness({ ownStore: true, legal: full, contactEmail: "sac@loja.example", env })).toEqual([]);
  });
  it("says nothing while the own store is off", () => {
    expect(ownStoreReadiness({ ownStore: false, legal: null, contactEmail: "", env: {} })).toEqual([]);
  });
  it("flags missing seller data and missing env names without printing values", () => {
    const issues = ownStoreReadiness({ ownStore: true, legal: { ...full, tax_id: "" }, contactEmail: "", env: { ...env, STRIPE_WEBHOOK_SECRET: "", RESEND_API_KEY: undefined } });
    expect(issues.map((i) => i.key)).toEqual(["seller", "stripe", "email"]);
    expect(issues[0].message).toContain("CNPJ");
    expect(issues[0].message).toContain("E-mail de contato");
    expect(issues[1].message).toContain("STRIPE_WEBHOOK_SECRET");
    expect(issues[2].message).toContain("RESEND_API_KEY");
    expect(issues.map((i) => i.message).join(" ")).not.toContain("sac@");
  });
  it("flags a non-https site URL in production", () => {
    expect(ownStoreReadiness({ ownStore: true, legal: full, contactEmail: "a@b.co", env: { ...env, NEXT_PUBLIC_SITE_URL: "http://localhost:3300" } }).map((i) => i.key)).toEqual(["site_url"]);
  });
});
