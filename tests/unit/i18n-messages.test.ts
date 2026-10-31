import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const LOCALES = ["pt-BR", "pt-PT", "en", "es"] as const;

function flatten(obj: unknown, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) Object.assign(out, flatten(v, prefix ? `${prefix}.${k}` : k));
  } else out[prefix] = obj;
  return out;
}

function load(locale: string) {
  const p = `messages/${locale}.json`;
  expect(existsSync(p), `${p} exists`).toBe(true);
  return flatten(JSON.parse(readFileSync(p, "utf8")));
}

describe("message files", () => {
  const base = load("pt-BR");
  it("pt-BR has the required namespaces", () => {
    const namespaces = new Set(Object.keys(base).map((k) => k.split(".")[0]));
    for (const ns of ["common", "header", "footer", "home", "catalog", "product", "account", "auth", "legal", "cookies", "errors", "empty"]) {
      expect(namespaces.has(ns), ns).toBe(true);
    }
  });
  for (const locale of LOCALES) {
    it(`${locale} has the same keys as pt-BR and no empty values`, () => {
      const m = load(locale);
      expect(Object.keys(m).sort()).toEqual(Object.keys(base).sort());
      const empty = Object.entries(m).filter(([, v]) => typeof v !== "string" || v.trim() === "").map(([k]) => k);
      expect(empty).toEqual([]);
    });
  }
});
