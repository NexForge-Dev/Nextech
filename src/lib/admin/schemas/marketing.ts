import { z } from "zod";
import { slugSchema, storagePath, translationsSchema } from "./common";

const dateRequired = (msg: string) =>
  z
    .string()
    .trim()
    .min(1, msg)
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Data inválida.")
    .transform((v) => new Date(v).toISOString());

const dateOptional = z
  .string()
  .trim()
  .optional()
  .default("")
  .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Data inválida.")
  .transform((v) => (v ? new Date(v).toISOString() : null));

function endAfterStart<T extends { startsAt: string | null; endsAt: string | null }>(v: T, ctx: z.RefinementCtx) {
  if (v.startsAt && v.endsAt && new Date(v.endsAt) <= new Date(v.startsAt)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "A data final deve ser depois da inicial." });
}

export const promotionSchema = z
  .object({
    id: z.string().uuid().optional(),
    productId: z.string().uuid("Escolha o produto."),
    linkId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    reason: z.string().trim().max(160).optional().default(""),
    startsAt: dateRequired("Informe o início."),
    endsAt: dateRequired("Informe o fim."),
    publishAt: dateOptional,
    highlighted: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .superRefine(endAfterStart);
export type PromotionInput = z.input<typeof promotionSchema>;

/** Internal path ("/pt-br/ofertas") or an https URL. Never javascript:, data: or //host. */
export const bannerLink = z
  .string()
  .trim()
  .max(500)
  .optional()
  .default("")
  .refine((v) => !v || (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")) || /^https:\/\/[^/\s]+\.[^/\s]+/.test(v), "Use um caminho interno (/pt-br/ofertas) ou um endereço https://.")
  .transform((v) => v || null);

export const bannerSchema = z
  .object({
    id: z.string().uuid().optional(),
    imagePath: z.string().trim().min(1, "Envie a imagem do banner.").max(300),
    mobileImagePath: storagePath,
    linkUrl: bannerLink,
    startsAt: dateOptional,
    endsAt: dateOptional,
    sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
    active: z.boolean().default(false),
    campaignId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    translations: translationsSchema({ title: z.string().trim().max(120), subtitle: z.string().trim().max(240).optional().default("") }, "title"),
  })
  .superRefine((v, ctx) => {
    endAfterStart(v, ctx);
    if (!v.translations["pt-BR"]) ctx.addIssue({ code: "custom", path: ["translations", "pt-BR", "title"], message: "Informe o título em português." });
  });
export type BannerInput = z.input<typeof bannerSchema>;

export const campaignSchema = z
  .object({
    id: z.string().uuid().optional(),
    slug: slugSchema,
    name: z.string().trim().min(1, "Informe o nome interno.").max(120),
    startsAt: dateOptional,
    endsAt: dateOptional,
    status: z.enum(["draft", "scheduled", "active", "ended"]),
    productIds: z.array(z.string().uuid()).max(200).default([]),
    bannerIds: z.array(z.string().uuid()).max(20).default([]),
    translations: translationsSchema({ title: z.string().trim().max(160), description: z.string().trim().max(2000).optional().default("") }, "title"),
  })
  .superRefine((v, ctx) => {
    endAfterStart(v, ctx);
    if (!v.translations["pt-BR"]) ctx.addIssue({ code: "custom", path: ["translations", "pt-BR", "title"], message: "Informe o título em português." });
  });
export type CampaignInput = z.input<typeof campaignSchema>;

/** Effective status shown in the admin: drafts stay drafts; others follow the dates. */
export function campaignStatusAt(status: string, startsAt: string | null, endsAt: string | null, now: Date): "draft" | "scheduled" | "active" | "ended" {
  if (status === "draft") return "draft";
  if (status === "ended" || (endsAt && new Date(endsAt) <= now)) return "ended";
  if (startsAt && new Date(startsAt) > now) return "scheduled";
  return "active";
}
