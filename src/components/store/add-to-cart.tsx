"use client";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { addToLocalCart } from "@/lib/cart/local-cart";
import { trackAdEvent } from "./marketing-tracker";

type Labels = { addToCart: string; buyNow: string; soldOut: string; added: string; viewCart: string };

export function AddToCart({ productId, priceMinor, available, labels }: { productId: string; priceMinor: number; available: boolean; labels: Labels }) {
  const router = useRouter();
  const btn = "flex h-12 w-full cursor-pointer items-center justify-center rounded-md text-sm font-semibold uppercase tracking-wide transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40";
  if (!available) {
    return (
      <button type="button" disabled className={`${btn} bg-black text-white`}>
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
        className={`${btn} bg-black text-white hover:bg-ink`}
        onClick={() => {
          add();
          toast.success(labels.added, { action: { label: labels.viewCart, onClick: () => router.push("/carrinho") } });
        }}
      >
        {labels.addToCart}
      </button>
      <button
        type="button"
        className={`${btn} border border-black bg-white text-black hover:bg-soft`}
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
