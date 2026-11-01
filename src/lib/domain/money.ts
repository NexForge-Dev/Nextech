import type { Locale } from "@/i18n/routing";

/** Number of minor-unit digits for an ISO-4217 currency (BRL 2, CLP 0, …). */
export function minorDigits(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Format an integer amount in minor units as a localized currency string. */
export function formatMoney(amountMinor: number, currency: string, locale: Locale): string {
  const digits = minorDigits(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amountMinor / 10 ** digits);
}

/**
 * Parse a human-entered price ("1.299,90", "1299.90", "1,299.90", "199") into minor units.
 * The last "," or "." followed by 1–2 digits (or up to the currency's digits) is the decimal separator.
 */
export function toMinor(input: string, currency: string): number | null {
  const s = input.trim().replace(/\s| /g, "").replace(/^[^\d-]+/, "");
  if (!s || s.startsWith("-") || !/^[\d.,]+$/.test(s)) return null;
  const digits = minorDigits(currency);
  const lastSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  let intPart = s;
  let fracPart = "";
  if (lastSep >= 0) {
    const tail = s.slice(lastSep + 1);
    const sepCount = (s.match(/[.,]/g) ?? []).length;
    const isDecimal = tail.length > 0 && tail.length <= Math.max(digits, 2) && !(sepCount === 1 && tail.length === 3);
    if (isDecimal) {
      intPart = s.slice(0, lastSep);
      fracPart = tail;
    }
  }
  intPart = intPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(intPart || "0") || !/^\d*$/.test(fracPart)) return null;
  const frac = (fracPart + "0".repeat(digits)).slice(0, digits);
  const value = Number(intPart || "0") * 10 ** digits + Number(frac || "0");
  return Number.isSafeInteger(value) ? value : null;
}
