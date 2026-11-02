import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Locale } from "@/i18n/routing";
import type { PublicSettings } from "@/lib/data/settings";
import { renderMarkdownSafe } from "@/lib/security/sanitize";

export const LEGAL_PAGES = ["about", "how-it-works", "how-we-earn", "faq", "contact", "privacy", "terms", "cookies", "affiliates", "returns", "shipping"] as const;
/** "store" texts (own store: we are the seller) live in <locale>/store/ and fall back to the default text. */
export type LegalVariant = "default" | "store";
export type LegalPage = (typeof LEGAL_PAGES)[number];

/** Date shown as "last updated" on institutional pages. Bump when the texts change. */
export const LEGAL_UPDATED_AT = "2026-11-02T12:00:00Z";

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
export async function loadLegal(page: LegalPage, locale: Locale, s: PublicSettings, variant: LegalVariant = "default"): Promise<string> {
  const base = path.join(process.cwd(), "src", "content", "legal", locale);
  const tryRead = (f: string) => readFile(f, "utf8").catch(() => null);
  const ptStore = path.join(process.cwd(), "src", "content", "legal", "pt-BR", "store", `${page}.md`);
  const md =
    (variant === "store" ? ((await tryRead(path.join(base, "store", `${page}.md`))) ?? null) : null) ??
    (await tryRead(path.join(base, `${page}.md`))) ??
    // own-store-only pages (returns, shipping) exist in pt-BR only: the own store sells in Brazil
    (await readFile(ptStore, "utf8"));
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
