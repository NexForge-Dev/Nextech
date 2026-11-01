import Papa from "papaparse";
import { toMinor, minorDigits } from "./money";

export const PRODUCT_CSV_COLUMNS = [
  "slug", "status", "category_slug", "brand_slug", "tags", "sku",
  "name_pt_br", "short_pt_br", "description_pt_br", "name_pt_pt", "name_en", "name_es",
  "store_slug", "market", "currency", "original_url", "affiliate_url", "price", "previous_price", "previous_verified", "previous_evidence", "image_urls",
] as const;

export type CsvOffer = {
  storeSlug: string;
  market: string;
  currency: string;
  originalUrl: string;
  affiliateUrl: string | null;
  priceMinor: number | null;
  previousPriceMinor: number | null;
  previousVerified: boolean;
  previousEvidence: string | null;
};

export type CsvProduct = {
  slug: string;
  status: "draft" | "published" | "archived";
  categorySlug: string;
  brandSlug: string | null;
  tags: string[];
  sku: string | null;
  names: { "pt-BR": string; "pt-PT"?: string; en?: string; es?: string };
  shortPtBr: string | null;
  descriptionPtBr: string | null;
  imageUrls: string[];
  offers: CsvOffer[];
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function price(raw: string, currency: string): number | null | "invalid" {
  if (!raw.trim()) return null;
  // CSV prices use a dot as decimal separator ("199.90")
  const v = toMinor(raw.trim().replace(/,/g, ""), currency);
  return v == null ? "invalid" : v;
}

/** Parse the product CSV: one row per offer, product fields repeat across rows with the same slug. */
export function parseProductsCsv(text: string): { products: CsvProduct[]; errors: { line: number; message: string }[] } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim().toLowerCase() });
  const errors: { line: number; message: string }[] = [];
  const missing = PRODUCT_CSV_COLUMNS.filter((c) => !parsed.meta.fields?.includes(c));
  if (missing.length) return { products: [], errors: [{ line: 1, message: `Colunas ausentes: ${missing.join(", ")}` }] };

  const bySlug = new Map<string, CsvProduct>();
  parsed.data.forEach((row, i) => {
    const line = i + 2;
    const get = (k: (typeof PRODUCT_CSV_COLUMNS)[number]) => (row[k] ?? "").trim();
    const slug = get("slug");
    const fail = (message: string) => errors.push({ line, message });
    if (!SLUG.test(slug)) return fail(`Slug inválido: "${slug}"`);
    const status = (get("status") || "draft") as CsvProduct["status"];
    if (!["draft", "published", "archived"].includes(status)) return fail(`Status inválido: "${status}"`);
    const categorySlug = get("category_slug");
    if (!SLUG.test(categorySlug)) return fail("Categoria (category_slug) obrigatória.");
    const name = get("name_pt_br");
    if (name.length < 2) return fail("Nome em português (name_pt_br) obrigatório.");

    let product = bySlug.get(slug);
    if (!product) {
      product = {
        slug,
        status,
        categorySlug,
        brandSlug: get("brand_slug") || null,
        tags: get("tags").split("|").map((t) => t.trim().toLowerCase()).filter(Boolean),
        sku: get("sku") || null,
        names: { "pt-BR": name, ...(get("name_pt_pt") && { "pt-PT": get("name_pt_pt") }), ...(get("name_en") && { en: get("name_en") }), ...(get("name_es") && { es: get("name_es") }) },
        shortPtBr: get("short_pt_br") || null,
        descriptionPtBr: get("description_pt_br") || null,
        imageUrls: get("image_urls").split("|").map((u) => u.trim()).filter(Boolean),
        offers: [],
      };
      bySlug.set(slug, product);
    }

    const storeSlug = get("store_slug");
    if (!storeSlug) return; // product-only row
    const market = get("market").toUpperCase();
    const currency = get("currency").toUpperCase();
    if (!/^[A-Z]{2}$/.test(market)) return fail("País (market) inválido.");
    if (!/^[A-Z]{3}$/.test(currency)) return fail("Moeda (currency) inválida.");
    const originalUrl = get("original_url");
    if (!originalUrl.startsWith("https://")) return fail("original_url deve começar com https://");
    const affiliateUrl = get("affiliate_url") || null;
    if (affiliateUrl && !affiliateUrl.startsWith("https://")) return fail("affiliate_url deve começar com https://");
    const p = price(get("price"), currency);
    if (p === "invalid") return fail(`Preço inválido: "${get("price")}"`);
    const prev = price(get("previous_price"), currency);
    if (prev === "invalid") return fail(`Preço anterior inválido: "${get("previous_price")}"`);
    const verified = ["true", "1", "sim", "yes"].includes(get("previous_verified").toLowerCase());
    const evidence = get("previous_evidence") || null;
    if (verified && (!prev || !evidence)) return fail("previous_verified exige previous_price e previous_evidence.");
    product.offers.push({ storeSlug, market, currency, originalUrl, affiliateUrl, priceMinor: p, previousPriceMinor: prev, previousVerified: verified, previousEvidence: evidence });
  });
  return { products: [...bySlug.values()], errors };
}

function decimal(minor: number | null, currency: string): string {
  if (minor == null) return "";
  const d = minorDigits(currency);
  return (minor / 10 ** d).toFixed(d);
}

/** Serialize products in the import format (round-trips with parseProductsCsv). */
export function toProductsCsv(products: CsvProduct[]): string {
  const rows: string[][] = [];
  for (const p of products) {
    const base = [p.slug, p.status, p.categorySlug, p.brandSlug ?? "", p.tags.join("|"), p.sku ?? "", p.names["pt-BR"], p.shortPtBr ?? "", p.descriptionPtBr ?? "", p.names["pt-PT"] ?? "", p.names.en ?? "", p.names.es ?? ""];
    const images = p.imageUrls.join("|");
    if (!p.offers.length) rows.push([...base, "", "", "", "", "", "", "", "false", "", images]);
    for (const o of p.offers) {
      rows.push([...base, o.storeSlug, o.market, o.currency, o.originalUrl, o.affiliateUrl ?? "", decimal(o.priceMinor, o.currency), decimal(o.previousPriceMinor, o.currency), String(o.previousVerified), o.previousEvidence ?? "", images]);
    }
  }
  return Papa.unparse({ fields: [...PRODUCT_CSV_COLUMNS], data: rows.map((r) => r.map(guardCell)) });
}

/** CSV-injection guard: cells starting with = + - @ are prefixed with an apostrophe. */
export function guardCell(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}
