import { createHash, createHmac } from "node:crypto";
import { amountToMinor, AdapterError, httpJson, type AffiliateAdapter } from "./types";

/** Product Advertising API 5.0 endpoints per marketplace. */
const HOSTS: Record<string, { host: string; region: string; marketplace: string; currency: string }> = {
  BR: { host: "webservices.amazon.com.br", region: "us-east-1", marketplace: "www.amazon.com.br", currency: "BRL" },
  US: { host: "webservices.amazon.com", region: "us-east-1", marketplace: "www.amazon.com", currency: "USD" },
  MX: { host: "webservices.amazon.com.mx", region: "us-east-1", marketplace: "www.amazon.com.mx", currency: "MXN" },
  ES: { host: "webservices.amazon.es", region: "eu-west-1", marketplace: "www.amazon.es", currency: "EUR" },
  PT: { host: "webservices.amazon.es", region: "eu-west-1", marketplace: "www.amazon.es", currency: "EUR" },
  GB: { host: "webservices.amazon.co.uk", region: "eu-west-1", marketplace: "www.amazon.co.uk", currency: "GBP" },
};

const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();
const sha = (data: string) => createHash("sha256").update(data).digest("hex");

/** AWS Signature V4 headers for a PA-API 5 POST (exported for tests). */
export function signPaapi(opts: { host: string; region: string; path: string; target: string; body: string; accessKey: string; secretKey: string; now: Date }) {
  const amzDate = opts.now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    "content-encoding": "amz-1.0",
    "content-type": "application/json; charset=utf-8",
    host: opts.host,
    "x-amz-date": amzDate,
    "x-amz-target": opts.target,
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonical = ["POST", opts.path, "", ...Object.keys(headers).sort().map((k) => `${k}:${headers[k]}`), "", signedHeaders, sha(opts.body)].join("\n");
  const scope = `${date}/${opts.region}/ProductAdvertisingAPI/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha(canonical)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${opts.secretKey}`, date), opts.region), "ProductAdvertisingAPI"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
  return { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` };
}

type GetItemsResponse = { ItemsResult?: { Items?: { ASIN: string; Offers?: { Listings?: { Price?: { Amount?: number; Currency?: string } }[] } }[] }; Errors?: { Message: string }[] };

/**
 * Amazon Product Advertising API 5.0 (GetItems) — the only allowed source of Amazon prices.
 * Access requires an approved Associates account with qualifying sales; disabled until configured.
 */
export const amazonPaapiAdapter: AffiliateAdapter = {
  key: "amazon_paapi",
  label: "Amazon Product Advertising API",
  verification: "Requisição GetItems com assinatura AWS SigV4 implementada conforme a documentação do PA-API 5.0. Não verificada com conta real (o acesso exige vendas qualificadas).",
  credentialFields: [
    { name: "accessKey", label: "Access key" },
    { name: "secretKey", label: "Secret key", secret: true },
  ],
  settingsFields: [
    { name: "enabled", label: "Ativar atualização de preços (true/false)" },
    ...Object.keys(HOSTS).map((m) => ({ name: `tag_${m}`, label: `Partner tag — ${m}` })),
  ],
  capabilities: { buildUrl: false, api: false, csv: false, prices: true },

  async fetchPrices(asins, market, creds, settings, fetchImpl = fetch) {
    if (settings.enabled !== "true") throw new AdapterError("PA-API desativada nas configurações da rede.");
    const h = HOSTS[market];
    const tag = settings[`tag_${market}`];
    if (!h || !tag) throw new AdapterError(`PA-API: configure o partner tag para ${market}.`);
    const out: { externalId: string; priceMinor: number; currency: string }[] = [];
    for (let i = 0; i < asins.length; i += 10) {
      const body = JSON.stringify({ ItemIds: asins.slice(i, i + 10), PartnerTag: tag, PartnerType: "Associates", Marketplace: h.marketplace, Resources: ["Offers.Listings.Price"] });
      const headers = signPaapi({ host: h.host, region: h.region, path: "/paapi5/getitems", target: "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems", body, accessKey: creds.accessKey ?? "", secretKey: creds.secretKey ?? "", now: new Date() });
      const data = await httpJson<GetItemsResponse>(fetchImpl, `https://${h.host}/paapi5/getitems`, { method: "POST", headers, body }, "PA-API GetItems");
      for (const item of data.ItemsResult?.Items ?? []) {
        const price = item.Offers?.Listings?.[0]?.Price;
        const minor = amountToMinor(price?.Amount);
        if (minor != null) out.push({ externalId: item.ASIN, priceMinor: minor, currency: (price?.Currency ?? h.currency).toUpperCase() });
      }
    }
    return out;
  },
};
