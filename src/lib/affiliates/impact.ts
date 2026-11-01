import { amountToMinor, httpJson, type AffiliateAdapter, type ConversionStatus } from "./types";

type ImpactAction = { Id: string; State: string; Amount?: string; Payout?: string; Currency?: string; EventDate: string; SubId1?: string };
type ImpactPage = { Actions?: ImpactAction[]; "@nextpageuri"?: string };

const STATUS: Record<string, ConversionStatus> = { PENDING: "pending", APPROVED: "confirmed", LOCKED: "confirmed", CLEARED: "confirmed", REVERSED: "rejected" };

/** impact.com Partner API — GET https://api.impact.com/Mediapartners/{AccountSID}/Actions (Basic auth SID:token). */
export const impactAdapter: AffiliateAdapter = {
  key: "impact",
  label: "Impact",
  verification: "Cliente implementado conforme a Partner API do impact.com (Actions). Testado com respostas de exemplo; não verificado com conta real.",
  credentialFields: [
    { name: "accountSid", label: "Account SID" },
    { name: "authToken", label: "Auth token", secret: true },
  ],
  settingsFields: [],
  capabilities: { buildUrl: false, api: true, csv: true, prices: false },

  async testConnection(creds, _settings, fetchImpl = fetch) {
    try {
      await httpJson(fetchImpl, `https://api.impact.com/Mediapartners/${encodeURIComponent(creds.accountSid ?? "")}/Campaigns?PageSize=1`, { headers: { Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64")}`, Accept: "application/json" } }, "Impact");
      return { ok: true, message: "Conexão com o Impact funcionando." };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Falha na conexão." };
    }
  },

  async fetchConversions(range, creds, _settings, fetchImpl = fetch) {
    const auth = `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64")}`;
    const first = new URL(`https://api.impact.com/Mediapartners/${encodeURIComponent(creds.accountSid ?? "")}/Actions`);
    first.searchParams.set("ActionDateStart", range.from.toISOString());
    first.searchParams.set("ActionDateEnd", range.to.toISOString());
    first.searchParams.set("PageSize", "1000");
    const actions: ImpactAction[] = [];
    let next: string | null = first.toString();
    for (let i = 0; next && i < 100; i++) {
      const page: ImpactPage = await httpJson<ImpactPage>(fetchImpl, next, { headers: { Authorization: auth, Accept: "application/json" } }, "Impact actions");
      actions.push(...(page.Actions ?? []));
      next = page["@nextpageuri"] ? new URL(page["@nextpageuri"], "https://api.impact.com").toString() : null;
    }
    return actions.map((a) => ({
      externalId: a.Id,
      occurredAt: new Date(a.EventDate).toISOString(),
      status: STATUS[a.State?.toUpperCase()] ?? "pending",
      saleAmountMinor: amountToMinor(a.Amount),
      currency: (a.Currency ?? "USD").toUpperCase(),
      commissionMinor: amountToMinor(a.Payout),
      clickRef: a.SubId1 || null,
      raw: a,
    }));
  },
};
