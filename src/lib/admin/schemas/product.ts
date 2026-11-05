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

const saleInputSchema = z.object({
  price: z.string().trim().default(""),
  compareAt: z.string().trim().optional().default(""),
  pixDiscountPct: z.string().trim().optional().default("0"),
  available: z.boolean().default(true),
  deliveryMinDays: z.coerce.number().int().min(0, "Mínimo 0 dia.").max(120).default(3),
  deliveryMaxDays: z.coerce.number().int().min(0).max(120, "Máximo 120 dias.").default(7),
  fulfillment: z.enum(["stock", "dropship"]).default("dropship"),
  stock: z.string().trim().optional().default(""),
});

const supplierInputSchema = z.object({
  supplierId: z.string().uuid("Escolha o fornecedor."),
  url: z.string().trim().optional().default(""),
  cost: z.string().trim().optional().default(""),
  isPrimary: z.boolean().default(false),
  notes: optionalText(500),
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
    /** Left out by the CSV import, which must not clear what the product already has. */
    warranty: z.string().trim().max(120, "Garantia: use no máximo 120 caracteres.").optional(),
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
    saleMode: z.enum(["own", "affiliate"]).default("affiliate"),
    sale: saleInputSchema.optional(),
    suppliers: z.array(supplierInputSchema).max(10).default([]),
  })
  .superRefine((p, ctx) => {
    if (p.saleMode === "own") {
      const s = p.sale;
      const price = s?.price ? toMinor(s.price, "BRL") : null;
      if (!s?.price) ctx.addIssue({ code: "custom", path: ["sale", "price"], message: "Informe o preço de venda." });
      else if (price == null || price <= 0) ctx.addIssue({ code: "custom", path: ["sale", "price"], message: "Preço inválido." });
      if (s?.compareAt) {
        const cmp = toMinor(s.compareAt, "BRL");
        if (cmp == null) ctx.addIssue({ code: "custom", path: ["sale", "compareAt"], message: "Preço inválido." });
        else if (price != null && cmp <= price) ctx.addIssue({ code: "custom", path: ["sale", "compareAt"], message: "O preço “de” precisa ser maior que o preço de venda." });
      }
      const pct = Number((s?.pixDiscountPct || "0").replace(",", "."));
      if (!Number.isFinite(pct) || pct < 0 || pct > 50) ctx.addIssue({ code: "custom", path: ["sale", "pixDiscountPct"], message: "Desconto no Pix entre 0 e 50%." });
      if (s?.fulfillment === "stock" && !/^\d{1,6}$/.test(s.stock)) ctx.addIssue({ code: "custom", path: ["sale", "stock"], message: "Informe a quantidade em estoque." });
      if (s && s.deliveryMaxDays < s.deliveryMinDays) ctx.addIssue({ code: "custom", path: ["sale", "deliveryMaxDays"], message: "O prazo máximo precisa ser maior ou igual ao mínimo." });
    }
    if (p.suppliers.filter((x) => x.isPrimary).length > 1) ctx.addIssue({ code: "custom", path: ["suppliers"], message: "Marque no máximo um fornecedor principal." });
    p.suppliers.forEach((x, i) => {
      if (x.url && !https.safeParse(x.url).success) ctx.addIssue({ code: "custom", path: ["suppliers", i, "url"], message: "Use um endereço https:// válido." });
      if (x.cost && toMinor(x.cost, "BRL") == null) ctx.addIssue({ code: "custom", path: ["suppliers", i, "cost"], message: "Custo inválido." });
    });
    if (new Set(p.suppliers.map((x) => x.supplierId)).size !== p.suppliers.length) ctx.addIssue({ code: "custom", path: ["suppliers"], message: "Cada fornecedor só pode aparecer uma vez." });
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
    sale:
      p.saleMode === "own" && p.sale
        ? {
            priceMinor: toMinor(p.sale.price, "BRL")!,
            compareAtMinor: p.sale.compareAt ? toMinor(p.sale.compareAt, "BRL") : null,
            pixDiscountPct: Number((p.sale.pixDiscountPct || "0").replace(",", ".")),
            available: p.sale.available,
            deliveryMinDays: p.sale.deliveryMinDays,
            deliveryMaxDays: p.sale.deliveryMaxDays,
            fulfillment: p.sale.fulfillment,
            stockQuantity: p.sale.fulfillment === "stock" ? Number(p.sale.stock) : null,
          }
        : null,
    suppliers: p.suppliers.map((x) => ({ supplierId: x.supplierId, url: x.url || null, costMinor: x.cost ? toMinor(x.cost, "BRL") : null, isPrimary: x.isPrimary, notes: x.notes || null })),
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
