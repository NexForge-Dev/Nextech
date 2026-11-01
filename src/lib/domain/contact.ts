import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  subject: z.string().trim().max(160).optional().default(""),
  body: z.string().trim().min(10).max(5000),
  website: z.string().optional().default(""), // honeypot — humans never fill it
});

export type ContactInput = z.input<typeof contactSchema>;

/** Valid + honeypot filled → pretend success but don't store. */
export function classifyContact(input: ContactInput): { ok: boolean; store: boolean } {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, store: false };
  if (parsed.data.website.trim() !== "") return { ok: true, store: false };
  return { ok: true, store: true };
}
