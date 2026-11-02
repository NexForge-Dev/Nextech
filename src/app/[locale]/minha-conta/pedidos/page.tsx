import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { Link } from "@/i18n/navigation";
import { getMyOrders } from "@/lib/data/orders";
import { formatMoney } from "@/lib/domain/money";
import { storagePublicUrl } from "@/lib/supabase/env";

export const metadata = { robots: { index: false } };

export default async function MyOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params);
  const [t, format, orders] = await Promise.all([getTranslations("orders"), getFormatter(), getMyOrders()]);
  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold tracking-tight">{t("title")}</h2>
      {orders.length === 0 ? (
        <div className="rounded-md border border-line px-6 py-14 text-center">
          <p className="font-semibold">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-mute">{t("emptyText")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {orders.map((o) => {
            const img = storagePublicUrl("products", o.firstItem?.imagePath);
            return (
              <li key={o.number}>
                <Link href={{ pathname: "/minha-conta/pedidos/[number]", params: { number: String(o.number) } }} className="flex items-center gap-4 py-4 hover:bg-soft" data-testid="my-order">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-soft">{img && <Image src={img} alt="" fill sizes="56px" className="object-cover" unoptimized={img.endsWith(".svg")} />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {t("number", { number: o.number })} <span className="font-normal text-mute">· {format.dateTime(new Date(o.createdAt), { dateStyle: "medium" })}</span>
                    </p>
                    <p className="truncate text-sm text-mute">{o.firstItem?.name} · {t("items", { count: o.itemCount })}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="whitespace-nowrap rounded-full border border-black px-2 py-0.5 text-xs font-medium">{t(`stage_${o.stage}`)}</span>
                    <p className="tabular mt-1 text-sm font-semibold">{formatMoney(o.totalMinor, "BRL", "pt-BR")}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
