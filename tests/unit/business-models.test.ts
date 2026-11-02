import { describe, it, expect } from "vitest";
import { isModeVisible, parseBusinessModels, storefrontLocaleLock, toStoredBusinessModels, visibleModes } from "@/lib/domain/business-models";

const on = { ownStore: true, affiliates: true, payments: { card: true, boleto: true, pix: false } };

describe("business models", () => {
  it("parses the stored snake_case value", () => {
    expect(parseBusinessModels({ own_store: false, affiliates: true, payments: { card: true, boleto: false, pix: true } })).toEqual({
      ownStore: false, affiliates: true, payments: { card: true, boleto: false, pix: true },
    });
  });
  it("falls back to defaults for missing or broken values", () => {
    expect(parseBusinessModels(null)).toEqual({ ownStore: true, affiliates: false, payments: { card: true, boleto: true, pix: false } });
    expect(parseBusinessModels({ own_store: "yes", payments: { pix: 1 } })).toEqual({ ownStore: true, affiliates: false, payments: { card: true, boleto: true, pix: false } });
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
