import type { Locale } from "@/i18n/routing";
import { formatMoney } from "./money";

export type CurrencyAmount = { currency: string; amountMinor: number };
type Status = "pending" | "confirmed" | "rejected";

/** Commission totals per status and currency. Currencies are never converted or mixed. */
export function groupByCurrency(rows: { amountMinor: number; currency: string; status: string }[]): Record<Status, CurrencyAmount[]> {
  const acc: Record<Status, Map<string, number>> = { pending: new Map(), confirmed: new Map(), rejected: new Map() };
  for (const r of rows) {
    const s = (["pending", "confirmed", "rejected"] as Status[]).includes(r.status as Status) ? (r.status as Status) : "pending";
    acc[s].set(r.currency, (acc[s].get(r.currency) ?? 0) + r.amountMinor);
  }
  const out = (m: Map<string, number>) => [...m].map(([currency, amountMinor]) => ({ currency, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor);
  return { pending: out(acc.pending), confirmed: out(acc.confirmed), rejected: out(acc.rejected) };
}

export function formatCurrencyAmounts(list: CurrencyAmount[], locale: Locale): string {
  if (!list.length) return "—";
  return list.map((a) => formatMoney(a.amountMinor, a.currency, locale)).join(" · ");
}
