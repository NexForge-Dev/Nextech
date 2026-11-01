import { z } from "zod";
import { slugSchema, storagePath } from "./common";

export const brandSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Informe o nome.").max(120),
  slug: slugSchema,
  logoPath: storagePath,
  active: z.boolean(),
});
export type BrandInput = z.input<typeof brandSchema>;
