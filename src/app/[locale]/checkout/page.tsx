import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getBusinessModels, getPublicSettings } from "@/lib/data/settings";
import { sellerIdentityParts } from "@/lib/domain/seller";
import { getMyAddresses } from "@/actions/store/checkout";
import { isStripeConfigured } from "@/lib/stripe/server";
import { CheckoutForm } from "@/components/store/checkout-form";
import { Notice } from "@/components/store/ui";

export const metadata = { robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params);
  const bm = await getBusinessModels();
  if (!bm.ownStore) notFound();
  if (!(await getSessionUser())) redirect({ href: { pathname: "/entrar", query: { next: "/pt-br/checkout" } }, locale });
  const [t, saved, settings] = await Promise.all([getTranslations("checkout"), getMyAddresses(), getPublicSettings()]);
  const sellerParts = sellerIdentityParts(settings.legal);
  const seller = sellerParts.length ? [...sellerParts, settings.contactEmail.trim()].filter(Boolean).join(" · ") : null;
  return (
    <main className="shell pb-16 pt-6 md:pt-10">
      <h1 className="t-page mb-5 md:mb-6">{t("title")}</h1>
      {isStripeConfigured() ? (
        <CheckoutForm saved={saved} payments={bm.payments} seller={seller} />
      ) : (
        <Notice tone="error">{t("notConfigured")}</Notice>
      )}
    </main>
  );
}
