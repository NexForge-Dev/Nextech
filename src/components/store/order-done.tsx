"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { getMyOrderStatus, type MyOrderStatus } from "@/actions/store/checkout";
import { clearLocalCart } from "@/lib/cart/local-cart";
import { formatMoney } from "@/lib/domain/money";
import { trackAdEvent } from "./marketing-tracker";
import { BOLETO_SESSION_KEY } from "./checkout-form";

type Pay = { boleto?: { url: string; number: string | null; expiresAt: string | null }; pix?: { qrImageUrl: string; code: string; expiresAt: string | null } };

/** Success page body. Only reads the order status: the Stripe webhook is what marks it paid. */
export function OrderDone({ initial }: { initial: NonNullable<MyOrderStatus> }) {
  const t = useTranslations("checkout");
  const [o, setO] = useState(initial);
  const [pay, setPay] = useState<Pay>({});

  useEffect(() => {
    clearLocalCart();
    const readStoredPayment = () => {
      try {
        const raw = sessionStorage.getItem(BOLETO_SESSION_KEY(initial.number));
        if (raw) setPay(JSON.parse(raw) as Pay);
      } catch {
        /* ignore */
      }
    };
    readStoredPayment();
  }, [initial.number]);

  useEffect(() => {
    if (o.stage !== "awaiting_payment" || o.paymentMethod === "boleto") return;
    let tries = 0;
    const id = setInterval(async () => {
      tries += 1;
      const next = await getMyOrderStatus(o.number).catch(() => null);
      if (next) setO(next);
      if (tries >= 40 || (next && next.stage !== "awaiting_payment")) clearInterval(id);
    }, 3000);
    return () => clearInterval(id);
  }, [o.number, o.stage, o.paymentMethod]);

  const paid = o.stage !== "awaiting_payment" && o.stage !== "cancelled" && o.stage !== "refunded";
  useEffect(() => {
    if (paid) trackAdEvent("Purchase", { valueMinor: o.totalMinor, currency: "BRL", contentIds: [], orderNumber: o.number });
  }, [paid, o.number, o.totalMinor]);

  const boleto = o.boleto ?? pay.boleto ?? null;
  return (
    <div className="mt-6 space-y-6" data-testid="order-done" data-stage={o.stage}>
      <p className="text-sm text-mute">{formatMoney(o.totalMinor, "BRL", "pt-BR")}</p>
      {paid ? (
        <p className="text-lg">{t("donePaid")}</p>
      ) : o.stage === "cancelled" ? (
        <p className="text-lg">{t("doneFailed")}</p>
      ) : o.paymentMethod === "boleto" && boleto ? (
        <div className="space-y-4">
          <p className="text-lg">{t("doneBoleto")}</p>
          {boleto.number && <p className="break-all rounded-md bg-soft px-4 py-3 font-mono text-sm">{boleto.number}</p>}
          <div className="flex flex-wrap gap-3">
            {boleto.url && (
              <a href={boleto.url} target="_blank" rel="noopener" className="inline-flex h-11 items-center rounded-md bg-black px-5 text-sm font-semibold text-white hover:bg-ink">
                {t("openBoleto")}
              </a>
            )}
            {boleto.number && (
              <button type="button" className="h-11 cursor-pointer rounded-md border border-black px-5 text-sm font-semibold" onClick={() => navigator.clipboard?.writeText(boleto.number!).then(() => toast.success(t("copied")))}>
                {t("copyCode")}
              </button>
            )}
          </div>
        </div>
      ) : o.paymentMethod === "pix" && pay.pix ? (
        <div className="space-y-4">
          <p className="text-lg">{t("donePix")}</p>
          {pay.pix.qrImageUrl && <Image src={pay.pix.qrImageUrl} alt="QR Code Pix" width={224} height={224} unoptimized className="rounded-md border border-line" />}
          <button type="button" className="h-11 cursor-pointer rounded-md border border-black px-5 text-sm font-semibold" onClick={() => navigator.clipboard?.writeText(pay.pix!.code).then(() => toast.success(t("copied")))}>
            {t("copyCode")}
          </button>
        </div>
      ) : (
        <p className="text-lg">{t("doneProcessing")}</p>
      )}
      <Link href="/minha-conta/pedidos" className="inline-flex h-11 items-center rounded-md border border-line px-5 text-sm font-medium hover:bg-soft">
        {t("myOrders")}
      </Link>
    </div>
  );
}
