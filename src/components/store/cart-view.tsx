"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { loadCart, type CartView as CartData } from "@/actions/store/cart";
import { getLocalCart, MAX_QTY, onCartChange, removeFromLocalCart, setLocalCartQuantity } from "@/lib/cart/local-cart";
import { formatMoney } from "@/lib/domain/money";
import { storagePublicUrl } from "@/lib/supabase/env";

export function CartView() {
  const t = useTranslations("cart");
  const [data, setData] = useState<CartData | null>(null);
  const refresh = useCallback(() => {
    loadCart(getLocalCart()).then(setData, () => setData({ lines: [], subtotalMinor: 0, totalMinor: 0, checkoutable: false }));
  }, []);
  useEffect(() => {
    refresh();
    return onCartChange(refresh);
  }, [refresh]);

  if (!data) return <p className="py-10 text-sm text-mute">{t("loading")}</p>;
  if (!data.lines.length) {
    return (
      <div className="rounded-md border border-line px-6 py-14 text-center">
        <p className="font-semibold">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-mute">{t("emptyText")}</p>
        <Link href="/produtos" className="mt-6 inline-flex h-10 items-center rounded-md bg-black px-5 text-sm font-medium text-white hover:bg-ink">
          {t("explore")}
        </Link>
      </div>
    );
  }
  const money = (m: number) => formatMoney(m, "BRL", "pt-BR");
  const qtyBtn = "grid size-8 cursor-pointer place-items-center rounded-md border border-line hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <ul className="divide-y divide-line border-y border-line">
        {data.lines.map((l) => {
          const img = storagePublicUrl("products", l.imagePath ?? undefined);
          return (
            <li key={l.productId} className="flex gap-4 py-5" data-testid="cart-line">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-soft">{img && <Image src={img} alt="" fill sizes="80px" className="object-cover" unoptimized={img.endsWith(".svg")} />}</div>
              <div className="min-w-0 flex-1">
                {l.slug ? (
                  <Link href={{ pathname: "/produto/[slug]", params: { slug: l.slug } }} className="font-medium hover:underline">
                    {l.name}
                  </Link>
                ) : (
                  <p className="font-medium text-mute">{l.name ?? "—"}</p>
                )}
                {l.problem && <p role="alert" className="mt-1 text-sm font-medium">{l.problem === "unavailable" ? t("unavailable") : t("hidden")}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <span className="sr-only">{t("quantity")}</span>
                  <button type="button" className={qtyBtn} aria-label={t("decrease")} disabled={l.quantity <= 1 || !!l.problem} onClick={() => setLocalCartQuantity(l.productId, l.quantity - 1)}>
                    <Minus className="size-3.5" />
                  </button>
                  <span className="tabular w-6 text-center text-sm" data-testid="cart-qty">{l.quantity}</span>
                  <button type="button" className={qtyBtn} aria-label={t("increase")} disabled={l.quantity >= MAX_QTY || !!l.problem} onClick={() => setLocalCartQuantity(l.productId, l.quantity + 1)}>
                    <Plus className="size-3.5" />
                  </button>
                  <button type="button" className="ml-3 inline-flex cursor-pointer items-center gap-1 text-sm text-mute hover:text-black" onClick={() => removeFromLocalCart(l.productId)}>
                    <Trash2 className="size-3.5" /> {t("remove")}
                  </button>
                </div>
              </div>
              {!l.problem && <p className="tabular font-semibold">{money(l.lineTotalMinor)}</p>}
            </li>
          );
        })}
      </ul>
      <aside className="h-fit space-y-3 rounded-md border border-line p-5">
        <div className="flex justify-between text-sm"><span>{t("subtotal")}</span><span className="tabular">{money(data.subtotalMinor)}</span></div>
        <div className="flex justify-between text-sm"><span>{t("shipping")}</span><span>{t("free")}</span></div>
        <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><span>{t("total")}</span><span className="tabular" data-testid="cart-total">{money(data.totalMinor)}</span></div>
        {data.checkoutable ? (
          <Link href="/checkout" className="flex h-12 w-full items-center justify-center rounded-md bg-black text-sm font-semibold uppercase tracking-wide text-white hover:bg-ink">
            {t("checkout")}
          </Link>
        ) : (
          <button type="button" disabled className="h-12 w-full cursor-not-allowed rounded-md bg-black text-sm font-semibold uppercase tracking-wide text-white opacity-40">
            {t("checkout")}
          </button>
        )}
        <p className="text-center text-xs text-mute">{t("signInNote")}</p>
      </aside>
    </div>
  );
}
