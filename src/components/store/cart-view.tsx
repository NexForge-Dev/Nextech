"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { CircleAlert, Lock, Minus, Plus, RefreshCw, ShoppingBag, Trash2, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { loadCart, type CartView as CartData } from "@/actions/store/cart";
import { getLocalCart, MAX_QTY, onCartChange, removeFromLocalCart, setLocalCartQuantity } from "@/lib/cart/local-cart";
import { formatMoney } from "@/lib/domain/money";
import { storagePublicUrl } from "@/lib/supabase/env";
import { EmptyState, SummaryRow } from "./ui";

export function CartView({ signedIn = false }: { signedIn?: boolean }) {
  const t = useTranslations("cart");
  const ts = useTranslations("store");
  const [data, setData] = useState<CartData | null>(null);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(() => {
    loadCart(getLocalCart()).then(
      (d) => (setFailed(false), setData(d)),
      () => setFailed(true),
    );
  }, []);
  useEffect(() => {
    refresh();
    return onCartChange(refresh);
  }, [refresh]);

  if (failed && !data) {
    return (
      <EmptyState role="alert" icon={CircleAlert} title={t("loadError")}>
        <button type="button" onClick={refresh} className="btn btn-primary">
          <RefreshCw aria-hidden />
          {t("retry")}
        </button>
      </EmptyState>
    );
  }
  if (!data) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" aria-busy="true">
        <p className="sr-only">{t("loading")}</p>
        <div className="panel h-64 animate-pulse bg-soft" />
        <div className="panel h-52 animate-pulse bg-soft" />
      </div>
    );
  }
  if (!data.lines.length) {
    return (
      <EmptyState icon={ShoppingBag} title={t("emptyTitle")} text={t("emptyText")}>
        <Link href="/produtos" className="btn btn-primary">{t("explore")}</Link>
      </EmptyState>
    );
  }
  const money = (m: number) => formatMoney(m, "BRL", "pt-BR");
  const qtyBtn = "grid size-11 cursor-pointer place-items-center text-black transition-colors duration-150 hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40 md:size-8";
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <ul className="panel divide-y divide-line">
          {data.lines.map((l) => {
            const img = storagePublicUrl("products", l.imagePath ?? undefined);
            return (
              <li key={l.productId} className="flex gap-3 p-4 md:gap-4 md:p-5" data-testid="cart-line">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-line bg-white md:size-24">{img && <Image src={img} alt="" fill sizes="96px" className="object-contain p-1.5" unoptimized={img.endsWith(".svg")} />}</div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    {l.slug ? (
                      <Link href={{ pathname: "/produto/[slug]", params: { slug: l.slug } }} className="line-clamp-2 text-sm font-medium hover:underline md:text-[15px]">
                        {l.name}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-mute">{l.name ?? "—"}</p>
                    )}
                    {!l.problem && <p className="tabular hidden shrink-0 whitespace-nowrap font-semibold sm:block">{money(l.lineTotalMinor)}</p>}
                  </div>
                  {l.problem && (
                    <p role="alert" className="field-error">
                      <CircleAlert aria-hidden />
                      {l.problem === "short" ? t("short", { count: l.maxQuantity ?? 0 }) : l.problem === "unavailable" ? t("unavailable") : t("hidden")}
                    </p>
                  )}
                  {l.problem === "short" && (
                    <button type="button" className="mt-2 w-fit cursor-pointer text-sm font-medium underline underline-offset-2" onClick={() => setLocalCartQuantity(l.productId, l.maxQuantity ?? 1)}>
                      {t("useAvailable", { count: l.maxQuantity ?? 0 })}
                    </button>
                  )}
                  {!l.problem && <p className="tabular mt-1 font-semibold sm:hidden">{money(l.lineTotalMinor)}</p>}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                    <div className="inline-flex items-center overflow-hidden rounded-md border border-line">
                      <span className="sr-only">{t("quantity")}</span>
                      <button type="button" className={qtyBtn} aria-label={t("decrease")} disabled={l.quantity <= 1 || !!l.problem} onClick={() => setLocalCartQuantity(l.productId, l.quantity - 1)}>
                        <Minus className="size-3.5" aria-hidden />
                      </button>
                      <span className="tabular w-8 text-center text-sm font-medium" data-testid="cart-qty">{l.quantity}</span>
                      <button type="button" className={qtyBtn} aria-label={t("increase")} disabled={l.quantity >= Math.min(MAX_QTY, l.maxQuantity ?? MAX_QTY) || !!l.problem} onClick={() => setLocalCartQuantity(l.productId, l.quantity + 1)}>
                        <Plus className="size-3.5" aria-hidden />
                      </button>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm text-mute" onClick={() => removeFromLocalCart(l.productId)}>
                      <Trash2 aria-hidden /> {t("remove")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <Link href="/produtos" className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline">{ts("continueShopping")}</Link>
      </div>
      <aside className="panel space-y-3 p-5 lg:sticky lg:top-44">
        <SummaryRow label={t("subtotal")}>{money(data.subtotalMinor)}</SummaryRow>
        <SummaryRow label={t("shipping")}>{t("free")}</SummaryRow>
        <div className="border-t border-line pt-3">
          <div className="flex items-baseline justify-between gap-4 text-lg font-semibold tracking-tight">
            <span>{t("total")}</span>
            <span className="tabular" data-testid="cart-total">{money(data.totalMinor)}</span>
          </div>
        </div>
        {data.checkoutable ? (
          <Link href="/checkout" className="btn btn-primary btn-lg w-full">{t("checkout")}</Link>
        ) : (
          <button type="button" disabled className="btn btn-primary btn-lg w-full">{t("checkout")}</button>
        )}
        {!signedIn && <p className="text-center text-xs text-mute">{t("signInNote")}</p>}
        <ul className="space-y-1.5 border-t border-line pt-3 text-xs text-mute">
          <li className="flex items-center gap-2"><Truck className="size-3.5" strokeWidth={1.75} aria-hidden />{ts("freeShipping")}</li>
          <li className="flex items-center gap-2"><Lock className="size-3.5" strokeWidth={1.75} aria-hidden />{ts("securePayment")}</li>
        </ul>
      </aside>
    </div>
  );
}
