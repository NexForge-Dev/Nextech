import { z } from "zod";
import { httpsUrl, optionalUuid, slugSchema, storagePath } from "./common";

const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export function normalizeDomain(d: string): string {
  return d.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export const domainSchema = z
  .string()
  .transform(normalizeDomain)
  .refine((d) => HOST.test(d), "Informe apenas o domínio, sem https:// (ex.: amazon.com.br).");

export const storeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Informe o nome.").max(80),
  slug: slugSchema,
  logoPath: storagePath,
  officialUrl: httpsUrl,
  description: z.string().trim().max(2000).optional().default(""),
  networkId: optionalUuid,
  markets: z.array(z.string().regex(/^[A-Z]{2}$/)).max(50),
  priceDisplayPolicy: z.enum(["inherit", "show", "link_only"]),
  domains: z.array(domainSchema).min(1, "Cadastre pelo menos um domínio permitido.").max(30).transform((d) => [...new Set(d)]),
  active: z.boolean(),
});
export type StoreInput = z.input<typeof storeSchema>;

/** Domains suggested for Amazon stores per market. */
export const AMAZON_DOMAINS: Record<string, string[]> = {
  BR: ["amazon.com.br"],
  PT: ["amazon.es"],
  ES: ["amazon.es"],
  US: ["amazon.com"],
  GB: ["amazon.co.uk"],
  MX: ["amazon.com.mx"],
};
