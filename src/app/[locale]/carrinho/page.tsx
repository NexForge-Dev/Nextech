import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { getBusinessModels } from "@/lib/data/settings";
import { CartView } from "@/components/store/cart-view";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { robots: { index: false } };

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params);
  if (!(await getBusinessModels()).ownStore) notFound();
  const [t, user] = await Promise.all([getTranslations("cart"), getSessionUser()]);
  return (
    <main className="shell pb-16 pt-6 md:pt-10">
      <h1 className="t-page mb-5 md:mb-6">{t("title")}</h1>
      <CartView signedIn={!!user} />
    </main>
  );
}
