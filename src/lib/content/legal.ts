import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Locale } from "@/i18n/routing";
import type { PublicSettings } from "@/lib/data/settings";
import { renderMarkdownSafe } from "@/lib/security/sanitize";

export const LEGAL_PAGES = ["about", "how-it-works", "how-we-earn", "faq", "contact", "privacy", "terms", "cookies", "affiliates"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

/** Date shown as "last updated" on institutional pages. Bump when the texts change. */
export const LEGAL_UPDATED_AT = "2026-10-31T12:00:00Z";

const MISSING: Record<Locale, string> = {
  "pt-BR": "[a definir pelo responsável]",
  "pt-PT": "[a definir pelo responsável]",
  en: "[to be provided by the owner]",
  es: "[pendiente de definir por el responsable]",
};

const COMPANY_LABEL: Record<Locale, string> = { "pt-BR": "Empresa responsável", "pt-PT": "Empresa responsável", en: "Company", es: "Empresa responsable" };

function escapeMd(v: string): string {
  return v.replace(/[\\`*_{}[\]()#+!|<>]/g, (c) => `\\${c}`);
}

/** Load a page's Markdown, fill the placeholders from site settings and return sanitized HTML. */
export async function loadLegal(page: LegalPage, locale: Locale, s: PublicSettings): Promise<string> {
  const file = path.join(process.cwd(), "src", "content", "legal", locale, `${page}.md`);
  const md = await readFile(file, "utf8");
  const missing = MISSING[locale];
  const val = (v: string | undefined | null) => (v && v.trim() ? escapeMd(v.trim()) : missing);
  const company = s.legal.company_name?.trim()
    ? `**${COMPANY_LABEL[locale]}:** ${val(s.legal.company_name)}${s.legal.tax_id ? ` · ${val(s.legal.tax_id)}` : ""}${s.legal.address ? ` · ${val(s.legal.address)}` : ""}`
    : "";
  const filled = md
    .replaceAll("{{store_name}}", escapeMd(s.storeName))
    .replaceAll("{{company_name}}", val(s.legal.company_name))
    .replaceAll("{{tax_id}}", val(s.legal.tax_id))
    .replaceAll("{{address}}", val(s.legal.address))
    .replaceAll("{{contact_email}}", val(s.contactEmail))
    .replaceAll("{{company_block}}", company);
  return renderMarkdownSafe(filled);
}
