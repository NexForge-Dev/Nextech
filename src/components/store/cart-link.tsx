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
    <Link href="/carrinho" data-testid="cart-link" className="relative inline-flex h-11 items-center md:h-10 gap-2 rounded-md px-2.5 text-sm font-medium text-black transition-colors duration-150 hover:bg-soft" aria-label={count ? `${label} (${count})` : label}>
      <ShoppingBag className="size-5" strokeWidth={1.75} aria-hidden />
      <span className="hidden xl:inline">{label}</span>
      {count > 0 && <span className="tabular absolute left-6 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-black px-1 text-[10px] font-semibold text-white ring-2 ring-white xl:static xl:ring-0">{count}</span>}
    </Link>
  );
}
