import { describe, it, expect } from "vitest";
import { groupByCurrency, formatCurrencyAmounts } from "@/lib/domain/aggregates";

describe("groupByCurrency", () => {
  it("separates statuses and currencies without converting", () => {
    const g = groupByCurrency([
      { amountMinor: 10000, currency: "BRL", status: "confirmed" },
      { amountMinor: 5000, currency: "EUR", status: "confirmed" },
      { amountMinor: 3000, currency: "BRL", status: "pending" },
    ]);
    expect(g.confirmed).toEqual([{ currency: "BRL", amountMinor: 10000 }, { currency: "EUR", amountMinor: 5000 }]);
    expect(g.pending).toEqual([{ currency: "BRL", amountMinor: 3000 }]);
    expect(g.rejected).toEqual([]);
  });
  it("sums the same currency", () => {
    const g = groupByCurrency([{ amountMinor: 1, currency: "USD", status: "pending" }, { amountMinor: 2, currency: "USD", status: "pending" }]);
    expect(g.pending).toEqual([{ currency: "USD", amountMinor: 3 }]);
  });
  it("formats as a joined list or an em dash", () => {
    expect(formatCurrencyAmounts([], "pt-BR")).toBe("—");
    expect(formatCurrencyAmounts([{ currency: "BRL", amountMinor: 124000 }, { currency: "EUR", amountMinor: 8500 }], "pt-BR").replace(/ /g, " ")).toBe("R$ 1.240,00 · € 85,00");
  });
});
