import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug } from "@/lib/domain/slug";

describe("slug", () => {
  it("slugifies accents, ordinals and punctuation", () => {
    expect(slugify("Fone Bluetooth São João 2ª Geração!")).toBe("fone-bluetooth-sao-joao-2a-geracao");
  });
  it("collapses separators and trims", () => expect(slugify("  --Olá   Mundo__  ")).toBe("ola-mundo"));
  it("handles ç and ñ", () => expect(slugify("Açúcar & Niño")).toBe("acucar-nino"));
  it("finds the next free slug", async () => {
    await expect(uniqueSlug("x", (s) => Promise.resolve(s === "x" || s === "x-2"))).resolves.toBe("x-3");
  });
  it("returns the base when free", async () => {
    await expect(uniqueSlug("livre", () => Promise.resolve(false))).resolves.toBe("livre");
  });
});
