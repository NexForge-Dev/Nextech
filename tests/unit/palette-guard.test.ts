import { describe, it, expect } from "vitest";
import fg from "fast-glob";
import { readFileSync } from "node:fs";

const PALETTE = ["000000", "ffffff", "222222", "777777", "e5e5e5", "f7f7f7"];
const files = fg.sync(["src/**/*.{ts,tsx,css}"], { dot: false });

function normalize(hex: string): string {
  const h = hex.toLowerCase();
  if (h.length === 3 || h.length === 4) return h.split("").map((c) => c + c).join("");
  return h;
}

describe("palette guard", () => {
  it("finds source files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("uses only palette hex colours (8-digit only as black/white + alpha)", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
        const raw = m[1];
        if (![3, 4, 6, 8].includes(raw.length)) continue;
        const n = normalize(raw);
        const base = n.slice(0, 6);
        const ok = n.length === 8 ? base === "000000" || base === "ffffff" : PALETTE.includes(base);
        if (!ok) offenders.push(`${f}: #${raw}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("uses no Tailwind colour scales", () => {
    const re = /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|shadow|divide|accent|caret)-(?:red|blue|green|yellow|orange|purple|pink|indigo|emerald|teal|cyan|sky|violet|fuchsia|rose|amber|lime|slate|gray|zinc|neutral|stone)-\d/;
    const offenders = files.filter((f) => re.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("uses no oklch/hsl/rgb colour functions except black/white alpha", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\b(oklch|hsla?|rgba?)\(([^)]*)\)/g)) {
        const args = m[2].replace(/\s+/g, " ").trim();
        const bw = /^(0 0 0|255 255 255|0, ?0, ?0|255, ?255, ?255)\b/.test(args) || /^(0|1) 0 0\b/.test(args);
        if (!bw) offenders.push(`${f}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
