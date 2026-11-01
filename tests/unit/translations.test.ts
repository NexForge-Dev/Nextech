import { describe, it, expect } from "vitest";
import { pickTranslation } from "@/lib/data/translations";

describe("pickTranslation", () => {
  it("falls back to pt-BR", () => expect(pickTranslation([{ locale: "pt-BR", name: "A" }], "en")?.name).toBe("A"));
  it("prefers the exact locale", () => expect(pickTranslation([{ locale: "pt-BR", name: "A" }, { locale: "en", name: "B" }], "en")?.name).toBe("B"));
  it("falls back to the first row without pt-BR", () => expect(pickTranslation([{ locale: "es", name: "C" }], "en")?.name).toBe("C"));
  it("returns null for no rows", () => expect(pickTranslation([], "en")).toBeNull());
});
