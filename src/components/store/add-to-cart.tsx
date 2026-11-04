"use client";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { addToLocalCart } from "@/lib/cart/local-cart";
import { trackAdEvent } from "./marketing-tracker";

type Labels = { addToCart: string; buyNow: string; soldOut: string; added: string; viewCart: string };

export function AddToCart({ productId, priceMinor, available, labels }: { productId: string; priceMinor: number; available: boolean; labels: Labels }) {
  const router = useRouter();
  const btn = "btn btn-lg w-full";
  if (!available) {
    return (
      <button type="button" disabled className={`${btn} btn-primary`}>
        {labels.soldOut}
      </button>
    );
  }
  const add = () => {
    addToLocalCart(productId, 1);
    trackAdEvent("AddToCart", { valueMinor: priceMinor, currency: "BRL", contentIds: [productId] });
  };
  return (
    <div className="space-y-2">
      <button
        type="button"
        className={`${btn} btn-primary`}
        onClick={() => {
          add();
          toast.success(labels.added, { action: { label: labels.viewCart, onClick: () => router.push("/carrinho") } });
        }}
      >
        <ShoppingBag aria-hidden />
        {labels.addToCart}
      </button>
      <button
        type="button"
        className={`${btn} btn-outline`}
        onClick={() => {
          add();
          router.push("/checkout");
        }}
      >
        {labels.buyNow}
      </button>
    </div>
  );
}
