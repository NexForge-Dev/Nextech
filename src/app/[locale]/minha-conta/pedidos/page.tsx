import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronRight, Package } from "lucide-react";
import { pageLocale } from "@/i18n/page-locale";
import { Link } from "@/i18n/navigation";
import { getMyOrders } from "@/lib/data/orders";
import { formatMoney } from "@/lib/domain/money";
import { storagePublicUrl } from "@/lib/supabase/env";
import { EmptyState } from "@/components/store/ui";
import { OrderStageTag } from "@/components/store/order-stage-tag";

export const metadata = { robots: { index: false } };

export default async function MyOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params);
  const [t, format, orders] = await Promise.all([getTranslations("orders"), getFormatter(), getMyOrders()]);
  return (
    <div>
      <h2 className="t-section mb-5">{t("title")}</h2>
      {orders.length === 0 ? (
        <EmptyState icon={Package} title={t("emptyTitle")} text={t("emptyText")} />
      ) : (
        <ul className="panel divide-y divide-line">
          {orders.map((o) => {
            const img = storagePublicUrl("products", o.firstItem?.imagePath);
            return (
              <li key={o.number}>
                <Link href={{ pathname: "/minha-conta/pedidos/[number]", params: { number: String(o.number) } }} className="group flex items-center gap-3 p-4 transition-colors duration-150 hover:bg-soft md:gap-4" data-testid="my-order">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-line bg-white md:size-16">{img && <Image src={img} alt="" fill sizes="64px" className="object-contain p-1" unoptimized={img.endsWith(".svg")} />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold md:text-[15px]">{t("number", { number: o.number })}</p>
                    <p className="text-xs text-mute">{format.dateTime(new Date(o.createdAt), { dateStyle: "medium" })}</p>
                    <p className="mt-0.5 truncate text-sm text-mute">{o.firstItem?.name} · {t("items", { count: o.itemCount })}</p>
                    <div className="mt-1.5 md:hidden"><OrderStageTag stage={o.stage} label={t(`stage_${o.stage}`)} /></div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="hidden justify-end md:flex"><OrderStageTag stage={o.stage} label={t(`stage_${o.stage}`)} /></div>
                    <p className="tabular text-sm font-semibold md:mt-1.5">{formatMoney(o.totalMinor, "BRL", "pt-BR")}</p>
                  </div>
                  <ChevronRight className="hidden size-4 shrink-0 text-mute transition-transform duration-150 group-hover:translate-x-0.5 sm:block" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
