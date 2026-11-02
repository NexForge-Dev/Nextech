import type { Locale } from "@/i18n/routing";

/** Which business models are live. Stored in site_settings `public.business_models` (snake_case). */
export type BusinessModels = { ownStore: boolean; affiliates: boolean; payments: { card: boolean; boleto: boolean; pix: boolean } };
export type SaleMode = "own" | "affiliate";

export const DEFAULT_BUSINESS_MODELS: BusinessModels = { ownStore: true, affiliates: false, payments: { card: true, boleto: true, pix: false } };

const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

export function parseBusinessModels(v: unknown): BusinessModels {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const p = o.payments && typeof o.payments === "object" ? (o.payments as Record<string, unknown>) : {};
  const d = DEFAULT_BUSINESS_MODELS;
  return {
    ownStore: bool(o.own_store, d.ownStore),
    affiliates: bool(o.affiliates, d.affiliates),
    payments: { card: bool(p.card, d.payments.card), boleto: bool(p.boleto, d.payments.boleto), pix: bool(p.pix, d.payments.pix) },
  };
}

export function toStoredBusinessModels(b: BusinessModels) {
  return { own_store: b.ownStore, affiliates: b.affiliates, payments: { ...b.payments } };
}

export function isModeVisible(mode: SaleMode, b: BusinessModels): boolean {
  return mode === "own" ? b.ownStore : b.affiliates;
}

/** The own store sells only in Brazil: while affiliates are off, the storefront is pt-BR only. */
export function storefrontLocaleLock(b: BusinessModels): Locale | null {
  return b.affiliates ? null : "pt-BR";
}

export function visibleModes(b: BusinessModels): SaleMode[] {
  return (["own", "affiliate"] as const).filter((m) => isModeVisible(m, b));
}
