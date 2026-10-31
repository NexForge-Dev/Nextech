import { AdapterError, amountToMinor, httpJson, type AffiliateAdapter, type ConversionStatus } from "./types";

type AdmitadAction = { action_id: number | string; action_date: string; status: string; cart: number | string | null; payment: number | string | null; currency: string; subid?: string | null };

const STATUS: Record<string, ConversionStatus> = { pending: "pending", approved: "confirmed", approved_but_stalled: "confirmed", declined: "rejected" };

function ddmmyyyy(d: Date) {
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

async function token(creds: Record<string, string>, fetchImpl: typeof fetch): Promise<string> {
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: creds.clientId ?? "", scope: "statistics" });
  const data = await httpJson<{ access_token?: string }>(fetchImpl, "https://api.admitad.com/token/", { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body }, "Admitad token");
  if (!data.access_token) throw new AdapterError("Admitad: token não recebido.");
  return data.access_token;
}

/** Admitad publisher API — OAuth token (client credentials) + GET /statistics/actions/. */
export const admitadAdapter: AffiliateAdapter = {
  key: "admitad",
  label: "Admitad",
  verification: "Cliente implementado conforme a API de publishers da Admitad (token + statistics/actions). Testado com respostas de exemplo; não verificado com conta real.",
  credentialFields: [
    { name: "clientId", label: "Client ID", hint: "Admitad → API e aplicações" },
    { name: "clientSecret", label: "Client secret", secret: true },
  ],
  settingsFields: [],
  capabilities: { buildUrl: false, api: true, csv: true, prices: false },

  async testConnection(creds, _settings, fetchImpl = fetch) {
    try {
      await token(creds, fetchImpl);
      return { ok: true, message: "Token da Admitad obtido com sucesso." };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Falha na conexão." };
    }
  },

  async fetchConversions(range, creds, _settings, fetchImpl = fetch) {
    const access = await token(creds, fetchImpl);
    const out: AdmitadAction[] = [];
    for (let offset = 0; offset < 50_000; offset += 500) {
      const url = new URL("https://api.admitad.com/statistics/actions/");
      url.searchParams.set("date_start", ddmmyyyy(range.from));
      url.searchParams.set("date_end", ddmmyyyy(range.to));
      url.searchParams.set("limit", "500");
      url.searchParams.set("offset", String(offset));
      const page = await httpJson<{ results?: AdmitadAction[]; _meta?: { count?: number } }>(fetchImpl, url.toString(), { headers: { Authorization: `Bearer ${access}` } }, "Admitad actions");
      out.push(...(page.results ?? []));
      if (!page.results?.length || out.length >= (page._meta?.count ?? 0)) break;
    }
    return out.map((a) => ({
      externalId: String(a.action_id),
      occurredAt: new Date(`${a.action_date.replace(" ", "T")}Z`).toISOString(),
      status: STATUS[a.status] ?? "pending",
      saleAmountMinor: amountToMinor(a.cart),
      currency: (a.currency ?? "USD").toUpperCase(),
      commissionMinor: amountToMinor(a.payment),
      clickRef: a.subid || null,
      raw: a,
    }));
  },
};
