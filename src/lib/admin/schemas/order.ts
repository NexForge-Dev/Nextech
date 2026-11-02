import { z } from "zod";
import { toMinor } from "@/lib/domain/money";
import { adminCanSetStatus, ORDER_STATUSES } from "@/lib/domain/order-status";

const https = (v: string) => {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};
const optionalHttps = z
  .string()
  .trim()
  .max(500)
  .default("")
  .refine((v) => !v || https(v), "Use um endereço https:// válido.")
  .transform((v) => v || null);
const optText = (max: number) => z.string().trim().max(max).default("").transform((v) => v || null);

export const statusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(ORDER_STATUSES).refine(adminCanSetStatus, "O pagamento só é confirmado pelo Stripe."),
  /** The status the admin saw; the change is refused if the order moved meanwhile. */
  expected: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).default(""),
});

export const orderItemSchema = z
  .object({
    itemId: z.string().uuid(),
    supplierId: z.string().default(""),
    supplierCost: z.string().trim().default(""),
    supplierOrderRef: optText(120),
    supplierUrl: optionalHttps,
    trackingCarrier: optText(60),
    trackingCode: z.string().trim().toUpperCase().max(60).default("").transform((v) => v || null),
    trackingUrl: optionalHttps,
    purchased: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.supplierId && !z.string().uuid().safeParse(v.supplierId).success) ctx.addIssue({ code: "custom", path: ["supplierId"], message: "Fornecedor inválido." });
    if (v.purchased && !v.supplierId) ctx.addIssue({ code: "custom", path: ["supplierId"], message: "Informe onde comprou." });
    if (v.purchased && !v.supplierCost) ctx.addIssue({ code: "custom", path: ["supplierCost"], message: "Informe quanto pagou." });
    if (v.supplierCost && toMinor(v.supplierCost, "BRL") == null) ctx.addIssue({ code: "custom", path: ["supplierCost"], message: "Valor inválido." });
  })
  .transform((v) => ({ ...v, supplierId: v.supplierId || null, supplierCostMinor: v.supplierCost ? toMinor(v.supplierCost, "BRL") : null }));

export const refundSchema = z
  .object({
    orderId: z.string().uuid(),
    amount: z.string().trim(),
    note: z.string().trim().max(500).default(""),
    manual: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const m = toMinor(v.amount, "BRL");
    if (m == null || m <= 0) ctx.addIssue({ code: "custom", path: ["amount"], message: "Informe o valor do reembolso." });
  })
  .transform((v) => ({ ...v, amountMinor: toMinor(v.amount, "BRL")! }));

export const resolveReturnSchema = z
  .object({
    returnId: z.string().uuid(),
    outcome: z.enum(["refund_full", "refund_partial", "replacement", "refused"]),
    note: z.string().trim().max(1000).default(""),
    refundAmount: z.string().trim().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.outcome === "refund_partial") {
      const m = toMinor(v.refundAmount, "BRL");
      if (m == null || m <= 0) ctx.addIssue({ code: "custom", path: ["refundAmount"], message: "Informe o valor do reembolso parcial." });
    }
    if (v.outcome === "refused" && !v.note) ctx.addIssue({ code: "custom", path: ["note"], message: "Explique ao cliente o motivo da recusa." });
  })
  .transform((v) => ({ ...v, refundAmountMinor: v.refundAmount ? toMinor(v.refundAmount, "BRL") : null }));

export const invoiceSchema = z.object({ orderId: z.string().uuid() });
