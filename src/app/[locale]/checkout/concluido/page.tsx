import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getMyOrderStatus } from "@/actions/store/checkout";
import { OrderDone } from "@/components/store/order-done";

export const metadata = { robots: { index: false } };

export default async function CheckoutDonePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ pedido?: string }> }) {
  const locale = await pageLocale(params);
  const n = Number((await searchParams).pedido);
  if (!(await getSessionUser())) redirect({ href: { pathname: "/entrar", query: { next: `/pt-br/checkout/concluido?pedido=${Number.isInteger(n) ? n : ""}` } }, locale });
  const [t, initial] = await Promise.all([getTranslations("checkout"), getMyOrderStatus(n)]);
  if (!initial) redirect({ href: "/minha-conta", locale });
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-20 pt-14 md:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("doneTitle", { number: initial!.number })}</h1>
      <OrderDone initial={initial!} />
    </main>
  );
}
