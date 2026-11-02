import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const LOCALES = ["pt-BR", "pt-PT", "en", "es"];
const PAGES = ["about", "how-it-works", "how-we-earn", "faq", "contact", "privacy", "terms", "cookies", "affiliates"];

describe("legal & institutional content", () => {
  for (const l of LOCALES) {
    it(`${l} has all ${PAGES.length} pages`, () => {
      for (const p of PAGES) expect(existsSync(`src/content/legal/${l}/${p}.md`), `${l}/${p}`).toBe(true);
    });
    it(`${l} privacy policy documents the consent cookie`, () => {
      expect(readFileSync(`src/content/legal/${l}/privacy.md`, "utf8")).toContain("nx_consent");
    });
    it(`${l} terms say the purchase happens at the partner store`, () => {
      expect(readFileSync(`src/content/legal/${l}/terms.md`, "utf8")).toMatch(/\{\{store_name\}\}/);
    });
  }
});

describe("own-store legal content (pt-BR)", () => {
  const STORE = ["terms", "privacy", "cookies", "how-it-works", "faq", "returns", "shipping"];
  it("has every own-store page", () => {
    for (const p of STORE) expect(existsSync(`src/content/legal/pt-BR/store/${p}.md`), p).toBe(true);
  });
  it("terms identify the seller and state the CDC rights", () => {
    const t = readFileSync("src/content/legal/pt-BR/store/terms.md", "utf8");
    expect(t).toContain("{{seller_identity}}");
    expect(t).toContain("{{contact_email}}");
    expect(t).toMatch(/7 dias/);
    expect(t).toMatch(/art\. 49/);
    expect(t).toMatch(/90 dias/);
    expect(t).toMatch(/Decreto nº 7\.962\/2013/);
  });
  it("returns policy explains how to withdraw and the full refund", () => {
    const t = readFileSync("src/content/legal/pt-BR/store/returns.md", "utf8");
    expect(t).toMatch(/7 dias corridos/);
    expect(t).toContain("{{contact_email}}");
    expect(t).toMatch(/todos os valores pagos/);
    expect(t).toMatch(/operadora do cartão imediatamente/);
  });
  it("only uses placeholders the loader fills", () => {
    const known = new Set(["store_name", "seller_identity", "company_name", "contact_email", "company_block"]);
    for (const l of [...LOCALES, "pt-BR/store"]) {
      for (const p of [...PAGES, "returns", "shipping"]) {
        const f = `src/content/legal/${l}/${p}.md`;
        if (!existsSync(f)) continue;
        for (const m of readFileSync(f, "utf8").matchAll(/\{\{(\w+)\}\}/g)) expect(known.has(m[1]), `${f}: {{${m[1]}}}`).toBe(true);
      }
    }
  });
  it("privacy covers purchase data and the consent cookie", () => {
    const t = readFileSync("src/content/legal/pt-BR/store/privacy.md", "utf8");
    for (const s of ["nx_consent", "CPF", "Stripe", "5 anos"]) expect(t).toContain(s);
  });
});

describe("legal loader variants", () => {
  it("serves the own-store text when the store variant is requested, the default otherwise", async () => {
    const { loadLegal } = await import("@/lib/content/legal");
    const s = { storeName: "NEXTECH", contactEmail: "", legal: { company_name: "Loja X", tax_id: "12.345.678/0001-90", address: "Rua A, 1" } } as never;
    expect(await loadLegal("terms", "pt-BR", s, "store")).toContain("12.345.678/0001-90");
    expect(await loadLegal("terms", "pt-BR", s, "store")).toContain("Quem vende");
    expect(await loadLegal("terms", "pt-BR", s)).toContain("links de afiliados");
    // no store variant for other locales: falls back to the default text
    expect(await loadLegal("terms", "en", s, "store")).toBeTruthy();
  });
  it("shows the full seller identity when it is set", async () => {
    const { loadLegal } = await import("@/lib/content/legal");
    const s = { storeName: "NEXTECH", contactEmail: "sac@loja.example", legal: { company_name: "Loja X LTDA", tax_id: "12.345.678/0001-90", address: "Rua A, 1" } } as never;
    const html = await loadLegal("terms", "pt-BR", s, "store");
    expect(html).toContain("Loja X LTDA, CNPJ 12.345.678/0001-90, Rua A, 1");
    expect(html).toContain("sac@loja.example");
  });
  it("never shows placeholders to customers when seller data is missing", async () => {
    const { loadLegal } = await import("@/lib/content/legal");
    const s = { storeName: "NEXTECH", contactEmail: "", legal: { company_name: "", tax_id: "", address: "" } } as never;
    for (const page of ["terms", "privacy", "returns", "faq", "about", "shipping"] as const) {
      const html = await loadLegal(page, "pt-BR", s, "store");
      expect(html, page).not.toMatch(/\{\{|\[a definir|CNPJ ,|CNPJ\s*\)/);
    }
    expect(await loadLegal("terms", "pt-BR", s, "store")).toContain("operada por NEXTECH");
    expect(await loadLegal("returns", "pt-BR", s, "store")).toContain("o formulário da página de Contato");
  });
});
