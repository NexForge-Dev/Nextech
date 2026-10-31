import { z } from "zod";
import { storagePath } from "./common";

const httpsOrEmpty = z
  .string()
  .trim()
  .max(300)
  .refine((v) => !v || /^https:\/\/[^\s/]+\.[^\s]+$/.test(v), "Use um endereço https:// completo.");

const perLocale = <T extends z.ZodTypeAny>(entry: T) => z.object({ "pt-BR": entry.optional(), "pt-PT": entry.optional(), en: entry.optional(), es: entry.optional() });

export const SOCIAL_KEYS = ["instagram", "facebook", "x", "tiktok", "youtube", "linkedin", "pinterest"] as const;

export const settingsSchema = z.object({
  storeName: z.string().trim().min(1, "Informe o nome da loja.").max(60),
  contactEmail: z.union([z.literal(""), z.string().trim().email("E-mail inválido.")]),
  logoPath: storagePath,
  faviconPath: storagePath,
  heroImage: storagePath,
  institutional: perLocale(z.string().trim().max(2000)),
  socials: z.partialRecord(z.enum(SOCIAL_KEYS), httpsOrEmpty).transform((s) => Object.fromEntries(Object.entries(s).filter(([, v]) => v))),
  seo: perLocale(z.object({ title: z.string().trim().max(70).optional().default(""), description: z.string().trim().max(170).optional().default("") })),
  analytics: z.object({
    ga4: z.string().trim().refine((v) => !v || /^G-[A-Z0-9]+$/.test(v), "ID do GA4 no formato G-XXXXXXX."),
    plausible: z.string().trim().refine((v) => !v || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v), "Informe só o domínio (ex.: nextech.com)."),
  }),
  cookieTexts: perLocale(z.object({ title: z.string().trim().max(80).optional().default(""), text: z.string().trim().max(500).optional().default("") })),
  legal: z.object({ company_name: z.string().trim().max(160), tax_id: z.string().trim().max(40), address: z.string().trim().max(300) }),
  priceStaleDays: z.coerce.number().int().min(1, "Mínimo 1 dia.").max(365),
});
export type SettingsInput = z.input<typeof settingsSchema>;
