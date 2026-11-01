import Papa from "papaparse";
import { createHash } from "node:crypto";
import { AdapterError, amountToMinor, type AffiliateAdapter, type NormalizedConversion } from "./types";

const MARKETS = ["BR", "US", "ES", "PT", "GB", "MX"];

/**
 * Amazon Associates. There is no public reporting API for Associates: conversions/earnings come from
 * the "Fee-Earnings" report CSV downloaded in Associates Central. Prices are NOT shown unless they come
 * from the Product Advertising API (see amazon-paapi.ts), per the Associates Operating Agreement.
 */
export const amazonAdapter: AffiliateAdapter = {
  key: "amazon",
  label: "Amazon Afiliados",
  verification: "Geração de link (parâmetro tag) segue a documentação oficial. Importação do relatório Fee-Earnings testada com arquivo de exemplo; não verificada com conta real.",
  credentialFields: [],
  settingsFields: MARKETS.map((m) => ({ name: `tag_${m}`, label: `Tracking ID (tag) — ${m}`, hint: "Ex.: nextech-20" })),
  capabilities: { buildUrl: true, api: false, csv: true, prices: false },

  buildAffiliateUrl(originalUrl, { market, settings }) {
    const tag = settings[`tag_${market}`]?.trim();
    if (!tag) throw new AdapterError(`Configure o Tracking ID (tag) da Amazon para o país ${market} nas configurações da rede.`);
    const u = new URL(originalUrl);
    u.searchParams.set("tag", tag);
    return u.toString();
  },

  parseReportCsv(text, opts) {
    const currency = opts?.currency ?? "BRL";
    // the report starts with a title line before the header
    const lines = text.replace(/^﻿/, "").split(/\r?\n/);
    const headerIdx = lines.findIndex((l) => /(^|,)ASIN(,|$)/i.test(l));
    if (headerIdx < 0) return { rows: [], errors: [{ line: 1, message: "Cabeçalho do relatório da Amazon não encontrado (coluna ASIN)." }] };
    const parsed = Papa.parse<Record<string, string>>(lines.slice(headerIdx).join("\n"), { header: true, skipEmptyLines: "greedy" });
    const col = (row: Record<string, string>, prefix: string) => {
      const key = Object.keys(row).find((k) => k.trim().toLowerCase().startsWith(prefix));
      return key ? (row[key] ?? "").trim() : "";
    };
    const rows: NormalizedConversion[] = [];
    const errors: { line: number; message: string }[] = [];
    parsed.data.forEach((row, i) => {
      const line = headerIdx + i + 2;
      const asin = col(row, "asin");
      const date = col(row, "date shipped") || col(row, "date");
      if (!asin || !/^\d{4}-\d{2}-\d{2}/.test(date)) return errors.push({ line, message: "Linha sem ASIN ou data de envio." });
      const items = Number(col(row, "items shipped") || "0");
      const returns = Number(col(row, "returns") || "0");
      const status = returns >= items && items > 0 ? "rejected" : "pending";
      const fingerprint = createHash("sha256").update([asin, date, col(row, "tracking id"), col(row, "price"), col(row, "device"), i].join("|")).digest("hex").slice(0, 24);
      rows.push({
        externalId: `amz-${fingerprint}`,
        occurredAt: new Date(`${date.slice(0, 10)}T12:00:00Z`).toISOString(),
        status,
        saleAmountMinor: amountToMinor(col(row, "revenue") || col(row, "price")),
        currency,
        commissionMinor: amountToMinor(col(row, "ad fees") || col(row, "earnings")),
        clickRef: null,
        raw: row,
      });
    });
    return { rows, errors };
  },
};
