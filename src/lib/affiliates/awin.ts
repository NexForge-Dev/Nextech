import { amountToMinor, httpJson, type AffiliateAdapter, type ConversionStatus } from "./types";

type AwinTx = {
  id: number | string;
  transactionDate: string;
  commissionStatus: string;
  saleAmount?: { amount: number; currency: string };
  commissionAmount?: { amount: number; currency: string };
  clickRefs?: Record<string, string> | null;
};

const STATUS: Record<string, ConversionStatus> = { pending: "pending", approved: "confirmed", declined: "rejected", deleted: "rejected" };

function awinDate(d: Date) {
  return d.toISOString().slice(0, 19);
}

/** Awin Publisher API — GET https://api.awin.com/publishers/{publisherId}/transactions/ with a Bearer token. */
export const awinAdapter: AffiliateAdapter = {
  key: "awin",
  label: "Awin",
  verification: "Cliente implementado conforme a Awin Publisher API (transactions). Testado com respostas de exemplo; não verificado com conta real.",
  credentialFields: [{ name: "token", label: "API token (OAuth2)", secret: true, hint: "Awin → Toolbox → API Credentials" }],
  settingsFields: [{ name: "publisherId", label: "Publisher ID" }],
  capabilities: { buildUrl: false, api: true, csv: true, prices: false },

  async testConnection(creds, settings, fetchImpl = fetch) {
    try {
      await httpJson(fetchImpl, `https://api.awin.com/publishers/${encodeURIComponent(settings.publisherId ?? "")}/programmes?relationship=joined`, { headers: { Authorization: `Bearer ${creds.token}` } }, "Awin");
      return { ok: true, message: "Conexão com a Awin funcionando." };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Falha na conexão." };
    }
  },

  async fetchConversions(range, creds, settings, fetchImpl = fetch) {
    const url = new URL(`https://api.awin.com/publishers/${encodeURIComponent(settings.publisherId ?? "")}/transactions/`);
    url.searchParams.set("startDate", awinDate(range.from));
    url.searchParams.set("endDate", awinDate(range.to));
    url.searchParams.set("timezone", "UTC");
    url.searchParams.set("dateType", "transaction");
    const data = await httpJson<AwinTx[]>(fetchImpl, url.toString(), { headers: { Authorization: `Bearer ${creds.token}`, Accept: "application/json" } }, "Awin transactions");
    return (Array.isArray(data) ? data : []).map((t) => ({
      externalId: String(t.id),
      occurredAt: new Date(t.transactionDate.endsWith("Z") ? t.transactionDate : `${t.transactionDate}Z`).toISOString(),
      status: STATUS[t.commissionStatus?.toLowerCase()] ?? "pending",
      saleAmountMinor: amountToMinor(t.saleAmount?.amount),
      currency: (t.commissionAmount?.currency ?? t.saleAmount?.currency ?? "EUR").toUpperCase(),
      commissionMinor: amountToMinor(t.commissionAmount?.amount),
      clickRef: t.clickRefs?.clickRef || null,
      raw: t,
    }));
  },
};
