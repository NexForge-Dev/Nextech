"use client";
import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cartCount, getLocalCart, onCartChange } from "@/lib/cart/local-cart";

export function CartLink({ label }: { label: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(cartCount(getLocalCart()));
    update();
    return onCartChange(update);
  }, []);
  return (
    <Link href="/carrinho" data-testid="cart-link" className="relative inline-flex items-center gap-1.5 text-sm text-black transition-colors duration-150 hover:text-ink" aria-label={count ? `${label} (${count})` : label}>
      <ShoppingBag className="size-[18px]" strokeWidth={1.75} aria-hidden />
      <span className="hidden lg:inline">{label}</span>
      {count > 0 && <span className="tabular absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-black px-1 text-[10px] font-semibold text-white lg:static lg:ml-0.5">{count}</span>}
    </Link>
  );
}
