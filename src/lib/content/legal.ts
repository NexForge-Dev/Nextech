import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Locale } from "@/i18n/routing";
import type { PublicSettings } from "@/lib/data/settings";
import { renderMarkdownSafe } from "@/lib/security/sanitize";
import { resolveContactEmail, sellerIdentityParts } from "@/lib/domain/seller";

export const LEGAL_PAGES = ["about", "how-it-works", "how-we-earn", "faq", "contact", "privacy", "terms", "cookies", "affiliates", "returns", "shipping"] as const;
/** "store" texts (own store: we are the seller) live in <locale>/store/ and fall back to the default text. */
export type LegalVariant = "default" | "store";
export type LegalPage = (typeof LEGAL_PAGES)[number];

/** Date shown as "last updated" on institutional pages. Bump when the texts change. */
export const LEGAL_UPDATED_AT = "2026-11-05T12:00:00Z";

/**
 * Customers never see placeholder values. Missing seller data is left out of the sentence (and the
 * admin dashboard flags it); a blank contact e-mail falls back to the default address.
 */
const TAX_LABEL: Record<Locale, string> = { "pt-BR": "CNPJ", "pt-PT": "NIF", en: "Tax ID", es: "NIF" };

const COMPANY_LABEL: Record<Locale, string> = { "pt-BR": "Responsável pela loja", "pt-PT": "Empresa responsável", en: "Company", es: "Empresa responsable" };

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
  const clean = (v: string | undefined | null) => (v && v.trim() ? escapeMd(v.trim()) : "");
  const parts = sellerIdentityParts(s.legal, TAX_LABEL[locale]).map(escapeMd);
  const company = parts.length ? `**${COMPANY_LABEL[locale]}:** ${parts.join(" · ")}` : "";
  const filled = md
    .replaceAll("{{store_name}}", escapeMd(s.storeName))
    // "Razão social, CNPJ …, endereço" with only the fields that are set; the store name when none is
    .replaceAll("{{seller_identity}}", parts.length ? parts.join(", ") : escapeMd(s.storeName))
    .replaceAll("{{company_name}}", clean(s.legal.company_name) || escapeMd(s.storeName))
    .replaceAll("{{contact_email}}", escapeMd(resolveContactEmail(s.contactEmail)))
    .replaceAll("{{company_block}}", company);
  return renderMarkdownSafe(filled);
}
