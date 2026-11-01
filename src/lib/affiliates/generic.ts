import Papa from "papaparse";
import { amountToMinor, type AffiliateAdapter, type NormalizedConversion } from "./types";

/** Any other network: manual links + CSV import with a user-defined column and status mapping. */
export const genericAdapter: AffiliateAdapter = {
  key: "generic",
  label: "Outra rede (manual / CSV)",
  verification: "Importação por CSV com mapeamento de colunas definido pelo administrador.",
  credentialFields: [],
  settingsFields: [],
  capabilities: { buildUrl: false, api: false, csv: true, prices: false },

  parseReportCsv(text, opts) {
    const m = opts?.mapping;
    if (!m) return { rows: [], errors: [{ line: 1, message: "Defina o mapeamento de colunas." }] };
    const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
    const fields = parsed.meta.fields ?? [];
    const required = [m.externalId, m.date, m.status, m.commission, m.currency];
    const missing = required.filter((c) => !fields.includes(c));
    if (missing.length) return { rows: [], errors: [{ line: 1, message: `Colunas não encontradas: ${missing.join(", ")}` }] };
    const statusMap = Object.fromEntries(Object.entries(opts?.statusMap ?? {}).map(([k, v]) => [k.trim().toLowerCase(), v]));
    const rows: NormalizedConversion[] = [];
    const errors: { line: number; message: string }[] = [];
    parsed.data.forEach((r, i) => {
      const line = i + 2;
      const id = (r[m.externalId] ?? "").trim();
      const rawStatus = (r[m.status] ?? "").trim().toLowerCase();
      const status = statusMap[rawStatus];
      const date = new Date((r[m.date] ?? "").trim());
      const currency = (r[m.currency] ?? "").trim().toUpperCase();
      if (!id) return errors.push({ line, message: "Identificador vazio." });
      if (!status) return errors.push({ line, message: `Status "${rawStatus}" sem correspondência no mapeamento.` });
      if (Number.isNaN(date.getTime())) return errors.push({ line, message: "Data inválida." });
      if (!/^[A-Z]{3}$/.test(currency)) return errors.push({ line, message: "Moeda inválida." });
      rows.push({
        externalId: id,
        occurredAt: date.toISOString(),
        status,
        saleAmountMinor: m.saleAmount ? amountToMinor(r[m.saleAmount]) : null,
        currency,
        commissionMinor: amountToMinor(r[m.commission]),
        clickRef: m.clickRef ? (r[m.clickRef] ?? "").trim() || null : null,
        raw: r,
      });
    });
    return { rows, errors };
  },
};
