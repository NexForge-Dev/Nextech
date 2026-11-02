import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { Link } from "@/i18n/navigation";
import { getMyOrder } from "@/lib/data/orders";
import { canCustomerCancel } from "@/lib/domain/order-status";
import { formatMoney } from "@/lib/domain/money";
import { OrderActions } from "@/components/store/order-actions";

export const metadata = { robots: { index: false } };

type Step = { label: string; at: string | null; done: boolean; extra?: React.ReactNode };

export default async function MyOrderPage({ params }: { params: Promise<{ locale: string; number: string }> }) {
  await pageLocale(params);
  const { number } = await params;
  const order = await getMyOrder(Number(number));
  if (!order) notFound();
  const [t, format] = await Promise.all([getTranslations("orders"), getFormatter()]);
  const money = (m: number) => formatMoney(m, "BRL", "pt-BR");
  const when = (kind: string) => order.timeline.find((e) => e.kind === kind)?.at ?? null;
  const dt = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" }) : null);
  const trackings = order.items.filter((i) => i.trackingCode);
  const stageIndex = { awaiting_payment: -1, preparing: 1, shipped: 2, delivered: 3, cancelled: -1, refunded: -1 }[order.stage];
  const steps: Step[] = [
    { label: t("stepPaid"), at: when("paid"), done: stageIndex >= 1 },
    { label: t("stepPreparing"), at: null, done: stageIndex >= 1 },
    {
      label: t("stepShipped"),
      at: when("shipped"),
      done: stageIndex >= 2,
      extra: trackings.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-mute">
          {trackings.map((i) => (
            <li key={i.id} data-testid="tracking">
              {i.trackingCarrier} <span className="font-mono text-black">{i.trackingCode}</span>{" "}
              {i.trackingUrl && <a href={i.trackingUrl} target="_blank" rel="noopener" className="underline">{t("track")}</a>}
            </li>
          ))}
        </ul>
      ),
    },
    { label: t("stepDelivered"), at: when("delivered"), done: stageIndex >= 3 },
  ];
  const cancellable = canCustomerCancel(order.status, order.anyPurchased);
  const s = order.shipping;
  return (
    <div className="space-y-8" data-testid="my-order-detail">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t("number", { number: order.number })}</h2>
          <p className="text-sm text-mute">
            {format.dateTime(new Date(order.createdAt), { dateStyle: "long" })} · {money(order.totalMinor)} · {order.paymentSummary ?? t(`method_${order.paymentMethod}` as "method_card")}
          </p>
        </div>
        <span className="rounded-full border border-black px-3 py-1 text-sm font-medium" data-testid="order-stage">{t(`stage_${order.stage}`)}</span>
      </div>

      {order.stage !== "cancelled" && order.stage !== "refunded" && order.stage !== "awaiting_payment" && (
        <ol className="space-y-3">
          {steps.map((st) => (
            <li key={st.label} className="flex gap-3">
              <span className={`mt-1 size-3 shrink-0 rounded-full ${st.done ? "bg-black" : "border border-mute bg-white"}`} aria-hidden />
              <div>
                <p className={`text-sm ${st.done ? "font-medium" : "text-mute"}`}>
                  {st.label} {st.at && <span className="font-normal text-mute">· {dt(st.at)}</span>}
                </p>
                {st.done && st.extra}
              </div>
            </li>
          ))}
        </ol>
      )}

      {order.stage === "awaiting_payment" && order.boleto?.url && (
        <a href={order.boleto.url} target="_blank" rel="noopener" className="inline-flex h-11 items-center rounded-md bg-black px-5 text-sm font-semibold text-white hover:bg-ink">
          {t("openBoleto")}
        </a>
      )}

      <ul className="divide-y divide-line border-y border-line">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-4 py-3 text-sm">
            <span>
              {i.quantity}×{" "}
              {i.slug ? (
                <Link href={{ pathname: "/produto/[slug]", params: { slug: i.slug } }} className="hover:underline">{i.name}</Link>
              ) : (
                i.name
              )}
            </span>
            <span className="tabular">{money(i.lineTotalMinor)}</span>
          </li>
        ))}
        {order.discountMinor > 0 && (
          <li className="flex justify-between py-3 text-sm"><span>Pix</span><span className="tabular">−{money(order.discountMinor)}</span></li>
        )}
        <li className="flex justify-between py-3 font-semibold"><span>Total</span><span className="tabular">{money(order.totalMinor)}</span></li>
      </ul>
      {order.refundedMinor > 0 && <p className="text-sm">{t("refunded", { amount: money(order.refundedMinor) })}</p>}

      <div>
        <h3 className="text-sm font-semibold">{t("address")}</h3>
        <p className="mt-1 text-sm text-mute">
          {s.recipientName} · {s.street}, {s.number}
          {s.complement ? ` – ${s.complement}` : ""} · {s.district} · {s.city}/{s.state} · {s.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}
        </p>
      </div>

      {order.returnRequest && (
        <p className="rounded-md bg-soft px-4 py-3 text-sm" data-testid="return-status">
          {order.returnRequest.status === "open"
            ? t("returnOpen", { date: format.dateTime(new Date(order.returnRequest.createdAt), { dateStyle: "short" }) })
            : t("returnResolved", { outcome: t(`outcome_${order.returnRequest.outcome}` as "outcome_refused") })}
          {order.returnRequest.outcomeNote && <span className="mt-1 block text-mute">{order.returnRequest.outcomeNote}</span>}
        </p>
      )}

      <OrderActions
        orderNumber={order.number}
        cancellable={cancellable}
        canRequestReturn={order.stage !== "awaiting_payment" && order.stage !== "cancelled" && order.stage !== "refunded" && order.returnRequest?.status !== "open"}
        hasInvoice={order.hasInvoice}
      />
      <p className="text-xs text-mute">{t("cdc")}</p>
      <Link href="/minha-conta/pedidos" className="text-sm underline underline-offset-2">{t("back")}</Link>
    </div>
  );
}
