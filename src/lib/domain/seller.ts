/**
 * Seller identity required on Brazilian e-commerce sites (Decreto 7.962/2013, art. 2º): name, CPF or
 * CNPJ, physical address and an electronic contact. Values come only from site settings
 * (`public.legal`, `public.contact_email`) — never invented; missing ones are left out for customers
 * and reported to the admin instead. The contact e-mail alone has a real default, so customers always
 * have a service channel; the admin setting overrides it.
 */
export type LegalSettings = { company_name: string; tax_id: string; address: string };

export const DEFAULT_CONTACT_EMAIL = "nexforge.d4v29@gmail.com";

/** The contact customers see: the admin setting, or the default when it is blank. */
export function resolveContactEmail(setting: string | null | undefined): string {
  return (setting ?? "").trim() || DEFAULT_CONTACT_EMAIL;
}

export type SellerField = "company_name" | "tax_id" | "address" | "contact_email";

export const SELLER_FIELD_LABEL: Record<SellerField, string> = {
  company_name: "Nome ou razão social",
  tax_id: "CPF ou CNPJ",
  address: "Endereço",
  contact_email: "E-mail de contato",
};

const clean = (v: string | null | undefined) => (v ?? "").trim();

/** Which seller fields are still empty. */
export function sellerIdentityGaps(legal: Partial<LegalSettings> | null | undefined, contactEmail: string | null | undefined): SellerField[] {
  const gaps: SellerField[] = [];
  if (!clean(legal?.company_name)) gaps.push("company_name");
  if (!clean(legal?.tax_id)) gaps.push("tax_id");
  if (!clean(legal?.address)) gaps.push("address");
  if (!clean(contactEmail)) gaps.push("contact_email");
  return gaps;
}

/** Sales stay closed until name, tax id and address exist; the default e-mail does not stand in for them. */
export function isSellerIdentified(legal: Partial<LegalSettings> | null | undefined): boolean {
  return sellerIdentityGaps(legal, DEFAULT_CONTACT_EMAIL).length === 0;
}

/** The Brazilian label follows the number: 11 digits is a CPF (seller without CNPJ), anything else a CNPJ. */
function brazilianTaxLabel(tax: string): string {
  return tax.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ";
}

/** "Nome, CPF/CNPJ 00.000.000/0001-00, Endereço" from the fields that are set ([] when none). */
export function sellerIdentityParts(legal: Partial<LegalSettings> | null | undefined, taxLabel = "CNPJ"): string[] {
  const tax = clean(legal?.tax_id);
  const label = taxLabel === "CNPJ" ? brazilianTaxLabel(tax) : taxLabel;
  const alreadyLabelled = /^(cpf|cnpj)\b/i.test(tax) || tax.toUpperCase().startsWith(label.toUpperCase());
  const taxText = tax && !alreadyLabelled ? `${label} ${tax}` : tax;
  return [clean(legal?.company_name), taxText, clean(legal?.address)].filter(Boolean);
}

/** One line for footers and e-mails: identity fields that are set, then the contact. */
export function sellerContactLine(legal: Partial<LegalSettings> | null | undefined, contactEmail: string | null | undefined): string {
  return [...sellerIdentityParts(legal), resolveContactEmail(contactEmail)].join(" · ");
}
