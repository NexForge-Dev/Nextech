import { describe, it, expect } from "vitest";
import { formatMoney, toMinor, minorDigits } from "@/lib/domain/money";

const sp = (s: string) => s.replace(/ | /g, " ");

describe("formatMoney", () => {
  it("formats BRL in pt-BR", () => expect(sp(formatMoney(129990, "BRL", "pt-BR"))).toBe("R$ 1.299,90"));
  it("formats EUR in pt-PT", () => {
    const s = formatMoney(4999, "EUR", "pt-PT");
    expect(s).toContain("49,99");
    expect(s).toContain("€");
  });
  it("formats USD in en", () => expect(formatMoney(4999, "USD", "en")).toBe("$49.99"));
  it("handles zero-decimal currencies", () => {
    expect(minorDigits("CLP")).toBe(0);
    expect(sp(formatMoney(15990, "CLP", "es"))).toContain("15.990");
  });
});

describe("toMinor", () => {
  it("parses pt-BR thousands and decimal comma", () => expect(toMinor("1.299,90", "BRL")).toBe(129990));
  it("parses dot decimal", () => expect(toMinor("1299.90", "USD")).toBe(129990));
  it("parses en thousands comma", () => expect(toMinor("1,299.90", "USD")).toBe(129990));
  it("parses integers", () => expect(toMinor("199", "BRL")).toBe(19900));
  it("parses single comma decimal", () => expect(toMinor("199,9", "BRL")).toBe(19990));
  it("rejects garbage", () => expect(toMinor("abc", "BRL")).toBeNull());
  it("rejects negatives", () => expect(toMinor("-5", "BRL")).toBeNull());
  it("rejects empty", () => expect(toMinor("  ", "BRL")).toBeNull());
});
