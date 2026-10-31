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
