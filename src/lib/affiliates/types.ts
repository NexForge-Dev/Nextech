export type AdapterKey = "amazon" | "amazon_paapi" | "awin" | "admitad" | "impact" | "generic";
export type ConversionStatus = "pending" | "confirmed" | "rejected";

export type NormalizedConversion = {
  externalId: string;
  occurredAt: string;
  status: ConversionStatus;
  saleAmountMinor: number | null;
  currency: string;
  commissionMinor: number | null;
  clickRef: string | null;
  raw: unknown;
};

export type CsvParseResult = { rows: NormalizedConversion[]; errors: { line: number; message: string }[] };
export type GenericMapping = { externalId: string; date: string; status: string; saleAmount: string; commission: string; currency: string; clickRef?: string };
export type CsvOptions = { currency?: string; mapping?: GenericMapping; statusMap?: Record<string, ConversionStatus> };

export type FieldDef = { name: string; label: string; secret?: boolean; hint?: string };

export interface AffiliateAdapter {
  key: AdapterKey;
  label: string;
  /** Shown in the admin: what has (not) been verified against a live account. */
  verification: string;
  credentialFields: FieldDef[];
  settingsFields: FieldDef[];
  capabilities: { buildUrl: boolean; api: boolean; csv: boolean; prices: boolean };
  buildAffiliateUrl?(originalUrl: string, ctx: { market: string; settings: Record<string, string> }): string;
  testConnection?(creds: Record<string, string>, settings: Record<string, string>, fetchImpl?: typeof fetch): Promise<{ ok: boolean; message: string }>;
  fetchConversions?(range: { from: Date; to: Date }, creds: Record<string, string>, settings: Record<string, string>, fetchImpl?: typeof fetch): Promise<NormalizedConversion[]>;
  parseReportCsv?(text: string, opts?: CsvOptions): CsvParseResult;
  fetchPrices?(asins: string[], market: string, creds: Record<string, string>, settings: Record<string, string>, fetchImpl?: typeof fetch): Promise<{ externalId: string; priceMinor: number; currency: string }[]>;
}

/** Decimal amount ("12.34", 12.34) → minor units for a 2-digit currency (JPY-like currencies handled by caller). */
export function amountToMinor(v: unknown, digits = 2): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 10 ** digits) : null;
}

export class AdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterError";
  }
}

export async function httpJson<T>(fetchImpl: typeof fetch, input: string, init: RequestInit, what: string): Promise<T> {
  const res = await fetchImpl(input, { ...init, signal: init.signal ?? AbortSignal.timeout(20000) });
  if (!res.ok) throw new AdapterError(`${what}: HTTP ${res.status}`);
  return (await res.json()) as T;
}
