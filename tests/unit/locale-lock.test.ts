import { describe, it, expect } from "vitest";
import { lockedLocalePath } from "@/i18n/locale-lock";

describe("lockedLocalePath", () => {
  it("leaves pt-BR paths alone", () => {
    expect(lockedLocalePath("/pt-br/produtos")).toBeNull();
    expect(lockedLocalePath("/pt-br")).toBeNull();
  });
  it("maps other locale roots to pt-BR", () => {
    expect(lockedLocalePath("/es")).toBe("/pt-br");
    expect(lockedLocalePath("/en/")).toBe("/pt-br");
  });
  it("maps localized paths to their pt-BR equivalent", () => {
    expect(lockedLocalePath("/en/products")).toBe("/pt-br/produtos");
    expect(lockedLocalePath("/es/producto/fone-x")).toBe("/pt-br/produto/fone-x");
    expect(lockedLocalePath("/pt-pt/minha-conta")).toBe("/pt-br/minha-conta");
    expect(lockedLocalePath("/en/my-account/favorites")).toBe("/pt-br/minha-conta/favoritos");
  });
  it("falls back to the pt-BR home for unknown paths", () => expect(lockedLocalePath("/es/no-existe/x")).toBe("/pt-br"));
  it("ignores paths without a locale prefix", () => expect(lockedLocalePath("/produtos")).toBeNull());
});
