import type { Locale } from "@/i18n/routing";

/** Which business models are live. Stored in site_settings `public.business_models` (snake_case). */
export type BusinessModels = { ownStore: boolean; ownStock: boolean; dropshipping: boolean; affiliates: boolean; payments: { card: boolean; boleto: boolean; pix: boolean } };
export type SaleMode = "own" | "affiliate";
/** How a product sold through the NEXTECH checkout reaches the customer. */
export type Fulfillment = "stock" | "dropship";

export const DEFAULT_BUSINESS_MODELS: BusinessModels = { ownStore: true, ownStock: false, dropshipping: true, affiliates: false, payments: { card: true, boleto: true, pix: false } };

const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

export function parseBusinessModels(v: unknown): BusinessModels {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const p = o.payments && typeof o.payments === "object" ? (o.payments as Record<string, unknown>) : {};
  const d = DEFAULT_BUSINESS_MODELS;
  const ownStock = bool(o.own_stock, d.ownStock);
  const dropshipping = bool(o.dropshipping, bool(o.own_store, d.dropshipping));
  return {
    ownStore: ownStock || dropshipping,
    ownStock,
    dropshipping,
    affiliates: bool(o.affiliates, d.affiliates),
    payments: { card: bool(p.card, d.payments.card), boleto: bool(p.boleto, d.payments.boleto), pix: bool(p.pix, d.payments.pix) },
  };
}

export function toStoredBusinessModels(b: BusinessModels) {
  return { own_store: b.ownStock || b.dropshipping, own_stock: b.ownStock, dropshipping: b.dropshipping, affiliates: b.affiliates, payments: { ...b.payments } };
}

type ModeSwitches = Pick<BusinessModels, "ownStore"> & Partial<Pick<BusinessModels, "ownStock" | "dropshipping" | "affiliates">>;

/** With a fulfillment, answers for that exact switch; without one, for the checkout as a whole. */
export function isModeVisible(mode: SaleMode, b: ModeSwitches, fulfillment?: Fulfillment | null): boolean {
  if (mode === "affiliate") return !!b.affiliates;
  if (!fulfillment) return b.ownStore;
  return (fulfillment === "stock" ? b.ownStock : b.dropshipping) ?? b.ownStore;
}

/** The own store sells only in Brazil: while affiliates are off, the storefront is pt-BR only. */
export function storefrontLocaleLock(b: BusinessModels): Locale | null {
  return b.affiliates ? null : "pt-BR";
}

export function visibleModes(b: BusinessModels): SaleMode[] {
  return (["own", "affiliate"] as const).filter((m) => isModeVisible(m, b));
}
