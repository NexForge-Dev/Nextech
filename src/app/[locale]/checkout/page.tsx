import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getBusinessModels } from "@/lib/data/settings";
import { getMyAddresses } from "@/actions/store/checkout";
import { isStripeConfigured } from "@/lib/stripe/server";
import { CheckoutForm } from "@/components/store/checkout-form";

export const metadata = { robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params);
  const bm = await getBusinessModels();
  if (!bm.ownStore) notFound();
  if (!(await getSessionUser())) redirect({ href: { pathname: "/entrar", query: { next: "/pt-br/checkout" } }, locale });
  const [t, saved] = await Promise.all([getTranslations("checkout"), getMyAddresses()]);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 md:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
      {isStripeConfigured() ? (
        <CheckoutForm saved={saved} payments={bm.payments} />
      ) : (
        <p role="alert" className="rounded-md border border-black px-4 py-3 text-sm font-medium">{t("notConfigured")}</p>
      )}
    </main>
  );
}
