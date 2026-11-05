import { SELLER_FIELD_LABEL, sellerIdentityGaps, type LegalSettings } from "@/lib/domain/seller";

export type ReadinessIssue = { key: string; message: string; href?: string };

type Env = Record<string, string | undefined>;

/**
 * What still blocks a compliant own-store launch: seller identity (Decreto 7.962/2013) and the
 * server configuration for payments and order emails. Only presence is checked — never values.
 */
export function ownStoreReadiness(input: { ownStore: boolean; legal: Partial<LegalSettings> | null; contactEmail: string; env: Env }): ReadinessIssue[] {
  if (!input.ownStore) return [];
  const issues: ReadinessIssue[] = [];
  const gaps = sellerIdentityGaps(input.legal, input.contactEmail);
  if (gaps.length) {
    issues.push({
      key: "seller",
      message: `Dados do vendedor incompletos (${gaps.map((g) => SELLER_FIELD_LABEL[g]).join(", ")}). A lei do e-commerce (Decreto 7.962/2013) exige nome ou razão social, CPF ou CNPJ, endereço e contato visíveis no site; enquanto faltarem, eles não aparecem no rodapé, no checkout nem nos termos.`,
      href: "/admin/configuracoes",
    });
  }
  const env = input.env;
  const missing = (names: string[]) => names.filter((n) => !env[n]?.trim());
  const stripe = missing(["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"]);
  if (stripe.length) issues.push({ key: "stripe", message: `Pagamentos sem configuração completa: faltam ${stripe.join(", ")} no ambiente. Sem eles o checkout fica fechado.` });
  const email = missing(["RESEND_API_KEY", "EMAIL_FROM", "OWNER_ALERT_EMAIL"]);
  if (email.length) issues.push({ key: "email", message: `E-mails de pedido sem configuração completa: faltam ${email.join(", ")}. A confirmação do pedido e o boleto não chegam ao cliente por e-mail, e os alertas (novo pedido, contestação, reembolso) só aparecem neste painel.` });
  if (!env.CRON_SECRET?.trim()) issues.push({ key: "cron", message: "CRON_SECRET não definido: o cancelamento automático de pedidos não pagos não roda." });
  const site = env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  if (!/^https:\/\//.test(site) && env.NODE_ENV === "production") issues.push({ key: "site_url", message: "NEXT_PUBLIC_SITE_URL não aponta para o domínio de produção (https://…): links dos e-mails e SEO ficam errados." });
  return issues;
}
