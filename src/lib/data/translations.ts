import type { Locale } from "@/i18n/routing";

/** Exact locale → pt-BR → first available. */
export function pickTranslation<T extends { locale: string }>(rows: T[] | null | undefined, locale: Locale): T | null {
  if (!rows || rows.length === 0) return null;
  return rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === "pt-BR") ?? rows[0] ?? null;
}
