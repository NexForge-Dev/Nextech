/**
 * Seller identity required on Brazilian e-commerce sites (Decreto 7.962/2013, art. 2º): legal name,
 * CNPJ, physical address and an electronic contact. Values come only from site settings
 * (`public.legal`, `public.contact_email`) — never invented; missing ones are left out for customers
 * and reported to the admin instead.
 */
export type LegalSettings = { company_name: string; tax_id: string; address: string };

export type SellerField = "company_name" | "tax_id" | "address" | "contact_email";

export const SELLER_FIELD_LABEL: Record<SellerField, string> = {
  company_name: "Razão social",
  tax_id: "CNPJ",
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

/** "Razão social, CNPJ 00.000.000/0001-00, Endereço" from the fields that are set ("" when none). */
export function sellerIdentityParts(legal: Partial<LegalSettings> | null | undefined, taxLabel = "CNPJ"): string[] {
  const tax = clean(legal?.tax_id);
  const taxText = tax && !tax.toUpperCase().startsWith(taxLabel.toUpperCase()) ? `${taxLabel} ${tax}` : tax;
  return [clean(legal?.company_name), taxText, clean(legal?.address)].filter(Boolean);
}
