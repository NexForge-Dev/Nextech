import { z } from "zod";
import { storagePath } from "./common";
import { DEFAULT_BUSINESS_MODELS } from "@/lib/domain/business-models";

const httpsOrEmpty = z
  .string()
  .trim()
  .max(300)
  .refine((v) => !v || /^https:\/\/[^\s/]+\.[^\s]+$/.test(v), "Use um endereço https:// completo.");

const perLocale = <T extends z.ZodTypeAny>(entry: T) => z.object({ "pt-BR": entry.optional(), "pt-PT": entry.optional(), en: entry.optional(), es: entry.optional() });

export const GOOGLE_ADS_ID = /^AW-\d{6,15}$/;
export const GOOGLE_ADS_LABEL = /^[A-Za-z0-9_-]{4,40}$/;
export const META_PIXEL_ID = /^\d{8,20}$/;

export const businessModelsSchema = z
  .object({
    ownStore: z.boolean(),
    affiliates: z.boolean(),
    payments: z.object({ card: z.boolean(), boleto: z.boolean(), pix: z.boolean() }),
  })
  .refine((b) => !b.ownStore || b.payments.card || b.payments.boleto || b.payments.pix, {
    message: "Ative ao menos uma forma de pagamento.",
    path: ["payments"],
  });

export const SOCIAL_KEYS = ["instagram", "facebook", "x", "tiktok", "youtube", "linkedin", "pinterest"] as const;

export const settingsSchema = z.object({
  storeName: z.string().trim().min(1, "Informe o nome da loja.").max(60),
  contactEmail: z.union([z.literal(""), z.string().trim().email("E-mail inválido.")]),
  logoPath: storagePath,
  faviconPath: storagePath,
  heroImage: storagePath,
  flagshipProductId: z.string().uuid("Escolha um produto da lista.").nullable().optional().transform((v) => v ?? null),
  institutional: perLocale(z.string().trim().max(2000)),
  socials: z.partialRecord(z.enum(SOCIAL_KEYS), httpsOrEmpty).transform((s) => Object.fromEntries(Object.entries(s).filter(([, v]) => v))),
  seo: perLocale(z.object({ title: z.string().trim().max(70).optional().default(""), description: z.string().trim().max(170).optional().default("") })),
  analytics: z.object({
    ga4: z.string().trim().refine((v) => !v || /^G-[A-Z0-9]+$/.test(v), "ID do GA4 no formato G-XXXXXXX."),
    plausible: z.string().trim().refine((v) => !v || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v), "Informe só o domínio (ex.: nextech.com)."),
    googleAds: z.string().trim().optional().default("").refine((v) => !v || GOOGLE_ADS_ID.test(v), "ID do Google Ads no formato AW-123456789."),
    googleAdsConversion: z.string().trim().optional().default("").refine((v) => !v || GOOGLE_ADS_LABEL.test(v), "Rótulo de conversão inválido (só letras, números, - e _)."),
    metaPixel: z.string().trim().optional().default("").refine((v) => !v || META_PIXEL_ID.test(v), "ID do Pixel da Meta: só números (ex.: 1234567890123456)."),
  }),
  cookieTexts: perLocale(z.object({ title: z.string().trim().max(80).optional().default(""), text: z.string().trim().max(500).optional().default("") })),
  legal: z.object({ company_name: z.string().trim().max(160), tax_id: z.string().trim().max(40), address: z.string().trim().max(300) }),
  priceStaleDays: z.coerce.number().int().min(1, "Mínimo 1 dia.").max(365),
  businessModels: businessModelsSchema.optional().default(DEFAULT_BUSINESS_MODELS),
});
export type SettingsInput = z.input<typeof settingsSchema>;
