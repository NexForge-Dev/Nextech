import { describe, it, expect } from "vitest";
import { defaultMarketFor, resolveMarket } from "@/lib/domain/markets";

describe("markets", () => {
  it("maps locales to default markets", () => {
    expect(defaultMarketFor("pt-BR")).toBe("BR");
    expect(defaultMarketFor("pt-PT")).toBe("PT");
    expect(defaultMarketFor("en")).toBe("US");
    expect(defaultMarketFor("es")).toBe("ES");
  });
  it("uses a valid cookie market", () => expect(resolveMarket("PT", "pt-BR", ["BR", "PT"])).toBe("PT"));
  it("ignores an unknown cookie market", () => expect(resolveMarket("XX", "en", ["US"])).toBe("US"));
  it("keeps the locale default even without stores there", () => expect(resolveMarket(undefined, "es", ["BR"])).toBe("ES"));
  it("normalizes cookie case", () => expect(resolveMarket("pt", "en", ["PT"])).toBe("PT"));
});
