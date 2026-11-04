import { notFound } from "next/navigation";
import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowLeft, Check, ExternalLink, MapPin } from "lucide-react";
import { pageLocale } from "@/i18n/page-locale";
import { Link } from "@/i18n/navigation";
import { getMyOrder } from "@/lib/data/orders";
import { canCustomerCancel } from "@/lib/domain/order-status";
import { formatMoney } from "@/lib/domain/money";
import { storagePublicUrl } from "@/lib/supabase/env";
import { OrderActions } from "@/components/store/order-actions";
import { OrderStageTag } from "@/components/store/order-stage-tag";
import { Notice, SummaryRow } from "@/components/store/ui";

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
  // one shipment often covers several items: list each tracking code once
  const trackings = order.items.filter((i, idx, all) => i.trackingCode && all.findIndex((o) => o.trackingCode === i.trackingCode && o.trackingCarrier === i.trackingCarrier) === idx);
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
    <div className="space-y-4" data-testid="my-order-detail">
      <Link href="/minha-conta/pedidos" className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"><ArrowLeft className="size-4" aria-hidden />{t("back")}</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="t-section">{t("number", { number: order.number })}</h2>
          <p className="mt-0.5 text-sm text-mute">
            {format.dateTime(new Date(order.createdAt), { dateStyle: "long" })} · {money(order.totalMinor)} · {order.paymentSummary ?? t(`method_${order.paymentMethod}` as "method_card")}
          </p>
        </div>
        <OrderStageTag stage={order.stage} label={t(`stage_${order.stage}`)} data-testid="order-stage" />
      </div>

      {order.stage !== "cancelled" && order.stage !== "refunded" && order.stage !== "awaiting_payment" && (
        <ol className="panel p-5 md:p-6">
          {steps.map((st, i) => (
            <li key={st.label} className="relative flex gap-3 pb-6 last:pb-0">
              {i < steps.length - 1 && <span className={`absolute bottom-0 left-[11px] top-6 w-px ${steps[i + 1].done ? "bg-black" : "bg-line"}`} aria-hidden />}
              <span className={`grid size-6 shrink-0 place-items-center rounded-full border ${st.done ? "border-black bg-black text-white" : "border-line bg-white"}`} aria-hidden>
                {st.done && <Check className="size-3.5" strokeWidth={2.5} />}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={`text-sm ${st.done ? "font-medium" : "text-mute"}`}>{st.label}</p>
                {st.at && <p className="text-xs text-mute">{dt(st.at)}</p>}
                {st.done && st.extra}
              </div>
            </li>
          ))}
        </ol>
      )}

      {order.stage === "awaiting_payment" && order.boleto?.url && (
        <a href={order.boleto.url} target="_blank" rel="noopener" className="btn btn-primary">
          <ExternalLink aria-hidden />
          {t("openBoleto")}
        </a>
      )}

      <div className="panel">
        <ul className="divide-y divide-line">
          {order.items.map((i) => {
            const img = storagePublicUrl("products", i.imagePath);
            return (
              <li key={i.id} className="flex items-center gap-3 p-4 text-sm">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-line bg-white">{img && <Image src={img} alt="" fill sizes="56px" className="object-contain p-1" unoptimized={img.endsWith(".svg")} />}</div>
                <span className="min-w-0 flex-1">
                  {i.quantity}×{" "}
                  {i.slug ? (
                    <Link href={{ pathname: "/produto/[slug]", params: { slug: i.slug } }} className="hover:underline">{i.name}</Link>
                  ) : (
                    i.name
                  )}
                </span>
                <span className="tabular shrink-0 font-medium">{money(i.lineTotalMinor)}</span>
              </li>
            );
          })}
        </ul>
        <div className="space-y-2 border-t border-line p-4">
          {order.discountMinor > 0 && <SummaryRow label="Pix">−{money(order.discountMinor)}</SummaryRow>}
          <SummaryRow label="Total" strong>{money(order.totalMinor)}</SummaryRow>
          {order.refundedMinor > 0 && <p className="text-sm">{t("refunded", { amount: money(order.refundedMinor) })}</p>}
        </div>
      </div>

      <div className="panel p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4" strokeWidth={1.75} aria-hidden />{t("address")}</h3>
        <p className="mt-1.5 text-sm text-mute">
          {s.recipientName} · {s.street}, {s.number}
          {s.complement ? ` – ${s.complement}` : ""} · {s.district} · {s.city}/{s.state} · {s.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}
        </p>
      </div>

      {order.returnRequest && (
        <Notice data-testid="return-status">
          {order.returnRequest.status === "open"
            ? t("returnOpen", { date: format.dateTime(new Date(order.returnRequest.createdAt), { dateStyle: "short" }) })
            : t("returnResolved", { outcome: t(`outcome_${order.returnRequest.outcome}` as "outcome_refused") })}
          {order.returnRequest.outcomeNote && <span className="mt-1 block text-mute">{order.returnRequest.outcomeNote}</span>}
        </Notice>
      )}

      <OrderActions
        orderNumber={order.number}
        cancellable={cancellable}
        canRequestReturn={order.stage !== "awaiting_payment" && order.stage !== "cancelled" && order.stage !== "refunded" && order.returnRequest?.status !== "open"}
        hasInvoice={order.hasInvoice}
      />
      <p className="text-xs text-mute">{t("cdc")}</p>
    </div>
  );
}
