import { z } from "zod";
import { CATEGORY_ICONS } from "@/components/category-icon";
import { slugSchema, storagePath, translationsSchema } from "./common";

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  icon: z.string().refine((v) => (CATEGORY_ICONS as string[]).includes(v), "Escolha um ícone da lista."),
  imagePath: storagePath,
  sortOrder: z.coerce.number().int().min(0).max(100000),
  active: z.boolean(),
  translations: translationsSchema({ name: z.string().trim().max(80), description: z.string().trim().max(1000).optional().default("") }, "name"),
});
export type CategoryInput = z.input<typeof categorySchema>;
