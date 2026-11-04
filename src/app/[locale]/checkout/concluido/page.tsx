import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getMyOrderStatus } from "@/actions/store/checkout";
import { OrderDone } from "@/components/store/order-done";
import { isEmailConfigured } from "@/lib/email/send";

export const metadata = { robots: { index: false } };

export default async function CheckoutDonePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ pedido?: string; redirect_status?: string }> }) {
  const locale = await pageLocale(params);
  const sp = await searchParams;
  const n = Number(sp.pedido);
  if (!(await getSessionUser())) redirect({ href: { pathname: "/entrar", query: { next: `/pt-br/checkout/concluido?pedido=${Number.isInteger(n) ? n : ""}` } }, locale });
  const [t, initial] = await Promise.all([getTranslations("checkout"), getMyOrderStatus(n)]);
  if (!initial) redirect({ href: "/minha-conta", locale });
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 md:px-6 md:pt-12">
      <h1 className="t-page">{t("doneTitle", { number: initial!.number })}</h1>
      <OrderDone initial={initial!} redirectFailed={sp.redirect_status === "failed"} emailEnabled={isEmailConfigured()} />
    </main>
  );
}
