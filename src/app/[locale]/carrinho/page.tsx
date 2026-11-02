import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { getBusinessModels } from "@/lib/data/settings";
import { CartView } from "@/components/store/cart-view";

export const metadata = { robots: { index: false } };

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params);
  if (!(await getBusinessModels()).ownStore) notFound();
  const t = await getTranslations("cart");
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 md:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
      <CartView />
    </main>
  );
}
