"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { getMyOrderStatus, type MyOrderStatus } from "@/actions/store/checkout";
import { cancelMyOrder } from "@/actions/store/orders";
import { clearLocalCart } from "@/lib/cart/local-cart";
import { formatMoney } from "@/lib/domain/money";
import { trackAdEvent } from "./marketing-tracker";
import { BOLETO_SESSION_KEY } from "./checkout-form";

type Pay = { boleto?: { url: string; number: string | null; expiresAt: string | null }; pix?: { qrImageUrl: string; code: string; expiresAt: string | null } };

/** Success page body. Only reads the order status: the Stripe webhook is what marks it paid. */
const copy = (text: string, ok: string, fail: string) => {
  if (!navigator.clipboard) return void toast.error(fail);
  navigator.clipboard.writeText(text).then(() => toast.success(ok), () => toast.error(fail));
};

/**
 * `redirectFailed`: Stripe sent the customer back with redirect_status=failed (3DS/wallet declined).
 * The cart is cleared only once the payment went through (or a boleto/Pix voucher exists), so a
 * failed payment can be retried without rebuilding the cart.
 */
export function OrderDone({ initial, redirectFailed = false }: { initial: NonNullable<MyOrderStatus>; redirectFailed?: boolean }) {
  const t = useTranslations("checkout");
  const [o, setO] = useState(initial);
  const [pay, setPay] = useState<Pay>({});
  const [slow, setSlow] = useState(false);
  const failed = o.stage === "cancelled" || (redirectFailed && o.stage === "awaiting_payment");

  useEffect(() => {
    // the declined card order would only linger until the expiry cron: close it now (best-effort)
    if (redirectFailed && initial.stage === "awaiting_payment" && initial.paymentMethod === "card") void cancelMyOrder(initial.number).catch(() => undefined);
  }, [redirectFailed, initial.stage, initial.paymentMethod, initial.number]);

  useEffect(() => {
    if (!failed) clearLocalCart();
  }, [failed]);

  useEffect(() => {
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
    if (o.stage !== "awaiting_payment" || o.paymentMethod === "boleto" || redirectFailed) return;
    let tries = 0;
    const id = setInterval(async () => {
      tries += 1;
      const next = await getMyOrderStatus(o.number).catch(() => null);
      if (next) setO(next);
      if (next && next.stage !== "awaiting_payment") clearInterval(id);
      else if (tries >= 40) {
        clearInterval(id);
        setSlow(true);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [o.number, o.stage, o.paymentMethod, redirectFailed]);

  const paid = !failed && o.stage !== "awaiting_payment" && o.stage !== "refunded";
  useEffect(() => {
    if (paid) trackAdEvent("Purchase", { valueMinor: o.totalMinor, currency: "BRL", contentIds: [], orderNumber: o.number });
  }, [paid, o.number, o.totalMinor]);

  const boleto = o.boleto ?? pay.boleto ?? null;
  return (
    <div className="mt-6 space-y-6" data-testid="order-done" data-stage={o.stage} aria-live="polite">
      <p className="text-sm text-mute">{formatMoney(o.totalMinor, "BRL", "pt-BR")}</p>
      {paid ? (
        <p className="text-lg">{t("donePaid")}</p>
      ) : failed ? (
        <div className="space-y-4">
          <p className="text-lg">{t("doneFailed")}</p>
          <Link href="/checkout" className="inline-flex h-11 items-center rounded-md bg-black px-5 text-sm font-semibold text-white hover:bg-ink">
            {t("retry")}
          </Link>
        </div>
      ) : o.stage === "refunded" ? (
        <p className="text-lg">{t("doneRefunded")}</p>
      ) : o.paymentMethod === "boleto" && boleto ? (
        <div className="space-y-4">
          <p className="text-lg">{t("doneBoleto")}</p>
          {boleto.expiresAt && <p className="text-sm text-mute">{t("boletoDue", { date: new Date(boleto.expiresAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) })}</p>}
          {boleto.number && <p className="break-all rounded-md bg-soft px-4 py-3 font-mono text-sm">{boleto.number}</p>}
          <div className="flex flex-wrap gap-3">
            {boleto.url && (
              <a href={boleto.url} target="_blank" rel="noopener" className="inline-flex h-11 items-center rounded-md bg-black px-5 text-sm font-semibold text-white hover:bg-ink">
                {t("openBoleto")}
              </a>
            )}
            {boleto.number && (
              <button type="button" className="h-11 cursor-pointer rounded-md border border-black px-5 text-sm font-semibold" onClick={() => copy(boleto.number!, t("copied"), t("copyFailed"))}>
                {t("copyCode")}
              </button>
            )}
          </div>
        </div>
      ) : o.paymentMethod === "pix" && pay.pix ? (
        <div className="space-y-4">
          <p className="text-lg">{t("donePix")}</p>
          {pay.pix.qrImageUrl && <Image src={pay.pix.qrImageUrl} alt="QR Code Pix" width={224} height={224} unoptimized className="rounded-md border border-line" />}
          <button type="button" className="h-11 cursor-pointer rounded-md border border-black px-5 text-sm font-semibold" onClick={() => copy(pay.pix!.code, t("copied"), t("copyFailed"))}>
            {t("copyCode")}
          </button>
        </div>
      ) : (
        <p className="text-lg">{slow ? t("doneSlow") : t("doneProcessing")}</p>
      )}
      <Link href="/minha-conta/pedidos" className="inline-flex h-11 items-center rounded-md border border-line px-5 text-sm font-medium hover:bg-soft">
        {t("myOrders")}
      </Link>
    </div>
  );
}
