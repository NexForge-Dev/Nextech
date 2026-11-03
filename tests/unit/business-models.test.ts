import { describe, it, expect } from "vitest";
import { isModeVisible, parseBusinessModels, storefrontLocaleLock, toStoredBusinessModels, visibleModes } from "@/lib/domain/business-models";

const on = { ownStore: true, ownStock: false, dropshipping: true, affiliates: true, payments: { card: true, boleto: true, pix: false } };

describe("business models", () => {
  it("parses the stored snake_case value", () => {
    expect(parseBusinessModels({ own_store: false, affiliates: true, payments: { card: true, boleto: false, pix: true } })).toEqual({
      ownStore: false, ownStock: false, dropshipping: false, affiliates: true, payments: { card: true, boleto: false, pix: true },
    });
  });
  it("falls back to defaults for missing or broken values", () => {
    expect(parseBusinessModels(null)).toEqual({ ownStore: true, ownStock: false, dropshipping: true, affiliates: false, payments: { card: true, boleto: true, pix: false } });
    expect(parseBusinessModels({ own_store: "yes", payments: { pix: 1 } })).toEqual({ ownStore: true, ownStock: false, dropshipping: true, affiliates: false, payments: { card: true, boleto: true, pix: false } });
  });
  it("keeps what was sold before the three switches as dropshipping", () => {
    expect(parseBusinessModels({ own_store: true }).dropshipping).toBe(true);
    expect(parseBusinessModels({ own_store: true }).ownStock).toBe(false);
  });
  it("opens the checkout when either own mode is on", () => {
    expect(parseBusinessModels({ own_stock: true, dropshipping: false }).ownStore).toBe(true);
    expect(toStoredBusinessModels({ ...on, ownStock: true, dropshipping: false }).own_store).toBe(true);
    expect(toStoredBusinessModels({ ...on, ownStock: false, dropshipping: false }).own_store).toBe(false);
  });
  it("answers each own mode by its own switch", () => {
    const stockOnly = { ...on, ownStock: true, dropshipping: false };
    expect(isModeVisible("own", stockOnly, "stock")).toBe(true);
    expect(isModeVisible("own", stockOnly, "dropship")).toBe(false);
    expect(isModeVisible("own", stockOnly)).toBe(true);
  });
  it("round-trips through the stored shape", () => {
    expect(parseBusinessModels(toStoredBusinessModels(on))).toEqual(on);
  });
  it("shows each mode only while it is enabled", () => {
    expect(isModeVisible("own", { ...on, ownStore: true })).toBe(true);
    expect(isModeVisible("own", { ...on, ownStore: false })).toBe(false);
    expect(isModeVisible("affiliate", { ...on, affiliates: true })).toBe(true);
    expect(isModeVisible("affiliate", { ...on, affiliates: false })).toBe(false);
  });
  it("locks the storefront to pt-BR while affiliates are off", () => {
    expect(storefrontLocaleLock({ ...on, affiliates: false })).toBe("pt-BR");
    expect(storefrontLocaleLock({ ...on, affiliates: true })).toBeNull();
  });
  it("lists the visible sale modes", () => {
    expect(visibleModes({ ...on, ownStore: true, affiliates: false })).toEqual(["own"]);
    expect(visibleModes({ ...on, ownStore: true, affiliates: true })).toEqual(["own", "affiliate"]);
    expect(visibleModes({ ...on, ownStore: false, affiliates: false })).toEqual([]);
  });
});
