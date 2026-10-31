import { z } from "zod";

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Informe o slug.")
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens (ex.: fone-bluetooth).");

export const uuidSchema = z.string().uuid();
export const optionalUuid = z.string().uuid().nullable().optional().transform((v) => v ?? null);
export const storagePath = z.string().trim().max(300).nullable().optional().transform((v) => v || null);
export const httpsUrl = z.string().trim().url("URL inválida.").refine((v) => v.startsWith("https://"), "Use um endereço https://.");

export const LOCALE_CODES = ["pt-BR", "pt-PT", "en", "es"] as const;

/** Per-locale translations where pt-BR is mandatory and the others optional (empty ones dropped). */
export function translationsSchema<T extends z.ZodRawShape>(shape: T, requiredKey: keyof T & string) {
  const entry = z.object(shape);
  return z
    .object({ "pt-BR": entry, "pt-PT": entry.optional(), en: entry.optional(), es: entry.optional() })
    .transform((t) => {
      const out: Partial<Record<(typeof LOCALE_CODES)[number], z.infer<typeof entry>>> = {};
      for (const l of LOCALE_CODES) {
        const v = t[l] as Record<string, unknown> | undefined;
        if (v && typeof v[requiredKey] === "string" && (v[requiredKey] as string).trim()) out[l] = v as z.infer<typeof entry>;
      }
      return out;
    });
}
