import { z } from "zod";
import { toMinor } from "@/lib/domain/money";
import { validateExternalUrl } from "@/lib/domain/url-guard";
import { slugSchema } from "./common";

const specSchema = z.object({ label: z.string().trim().max(80), value: z.string().trim().max(300) });
const specList = z.array(specSchema).max(60).transform((l) => l.filter((s) => s.label && s.value));

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const https = z
  .string()
  .trim()
  .refine((v) => {
    try {
      return new URL(v).protocol === "https:";
    } catch {
      return false;
    }
  }, "Use um endereço https:// válido.");

export const offerInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    storeId: z.string().uuid("Escolha a loja."),
    networkId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    market: z.string().regex(/^[A-Z]{2}$/, "Escolha o país."),
    currency: z.string().regex(/^[A-Z]{3}$/, "Moeda inválida."),
    originalUrl: https,
    affiliateUrl: z.string().trim().optional().default(""),
    price: z.string().trim().optional().default(""),
    previousPrice: z.string().trim().optional().default(""),
    previousVerified: z.boolean().default(false),
    previousEvidence: optionalText(500),
    externalId: optionalText(120),
    active: z.boolean().default(true),
  })
  .superRefine((o, ctx) => {
    if (o.affiliateUrl && !https.safeParse(o.affiliateUrl).success) ctx.addIssue({ code: "custom", path: ["affiliateUrl"], message: "Use um endereço https:// válido." });
    if (o.price && toMinor(o.price, o.currency) == null) ctx.addIssue({ code: "custom", path: ["price"], message: "Preço inválido." });
    if (o.previousPrice && toMinor(o.previousPrice, o.currency) == null) ctx.addIssue({ code: "custom", path: ["previousPrice"], message: "Preço anterior inválido." });
    if (o.previousVerified && !o.previousPrice) ctx.addIssue({ code: "custom", path: ["previousPrice"], message: "Informe o preço anterior verificado." });
    if (o.previousVerified && !o.previousEvidence) ctx.addIssue({ code: "custom", path: ["previousEvidence"], message: "Informe a evidência (link ou nota) do preço anterior." });
  })
  .transform((o) => ({
    ...o,
    affiliateUrl: o.affiliateUrl || null,
    priceMinor: o.price ? toMinor(o.price, o.currency) : null,
    previousPriceMinor: o.previousPrice ? toMinor(o.previousPrice, o.currency) : null,
    previousVerified: o.previousVerified && !!o.previousPrice,
    previousEvidence: o.previousEvidence || null,
    externalId: o.externalId || null,
  }));

const translationSchema = z.object({
  name: z.string().trim().max(160),
  shortDescription: optionalText(280),
  descriptionMd: optionalText(20000),
  specs: specList.optional().default([]),
});

export const productInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    slug: slugSchema,
    brandId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    categoryId: z.string().uuid("Escolha a categoria."),
    tags: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Tags: use letras minúsculas, números e hífens.")).max(30).default([]),
    status: z.enum(["draft", "published", "archived"]),
    featured: z.boolean().default(false),
    sku: optionalText(80),
    externalId: optionalText(120),
    rating: z.string().trim().optional().default(""),
    ratingCount: z.string().trim().optional().default(""),
    ratingSource: optionalText(80),
    specs: specList.default([]),
    translations: z.object({
      "pt-BR": translationSchema.extend({ name: z.string().trim().min(2, "Informe o nome do produto (mín. 2 caracteres).").max(160) }),
      "pt-PT": translationSchema.optional(),
      en: translationSchema.optional(),
      es: translationSchema.optional(),
    }),
    images: z.array(z.object({ path: z.string().min(1).max(300), alt: z.string().max(200).default(""), isMain: z.boolean() })).max(20).default([]),
    offers: z.array(offerInputSchema).max(30).default([]),
  })
  .superRefine((p, ctx) => {
    if (p.images.length && p.images.filter((i) => i.isMain).length !== 1) ctx.addIssue({ code: "custom", path: ["images"], message: "Escolha exatamente uma imagem principal." });
    if (p.rating) {
      const n = Number(p.rating.replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > 5) ctx.addIssue({ code: "custom", path: ["rating"], message: "Avaliação entre 0 e 5." });
      if (!p.ratingSource) ctx.addIssue({ code: "custom", path: ["ratingSource"], message: "Informe a fonte da avaliação (ex.: Mercado Livre)." });
    }
    if (p.ratingCount && !/^\d+$/.test(p.ratingCount)) ctx.addIssue({ code: "custom", path: ["ratingCount"], message: "Número inteiro." });
  })
  .transform((p) => ({
    ...p,
    sku: p.sku || null,
    externalId: p.externalId || null,
    rating: p.rating ? Math.round(Number(p.rating.replace(",", ".")) * 10) / 10 : null,
    ratingCount: p.ratingCount ? Number(p.ratingCount) : null,
    ratingSource: p.ratingSource || null,
    translations: Object.fromEntries(Object.entries(p.translations).filter(([, t]) => t && t.name.trim())) as Partial<Record<"pt-BR" | "pt-PT" | "en" | "es", z.infer<typeof translationSchema>>>,
  }));

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductParsed = z.output<typeof productInputSchema>;

/** Offer URLs must point to a domain registered for the offer's store (same rule as /go). */
export function validateOfferUrls(
  offers: { storeId: string; originalUrl: string; affiliateUrl: string | null }[],
  stores: Map<string, { name: string; domains: string[] }>,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  offers.forEach((o, i) => {
    const store = stores.get(o.storeId);
    if (!store) {
      errors[`offers.${i}.storeId`] = ["Loja não encontrada."];
      return;
    }
    for (const field of ["originalUrl", "affiliateUrl"] as const) {
      const url = o[field];
      if (!url) continue;
      const r = validateExternalUrl(url, store.domains);
      if (!r.ok) {
        errors[`offers.${i}.${field}`] = [
          r.reason === "host_not_allowed" ? `Domínio "${r.host}" não está cadastrado na loja ${store.name}.` : r.reason === "not_https" ? "Use um endereço https://." : "URL inválida.",
        ];
      }
    }
  });
  return errors;
}
