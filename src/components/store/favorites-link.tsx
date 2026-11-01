"use client";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getLocalFavorites, onFavoritesChange } from "@/lib/favorites-local";

export function FavoritesLink({ label, serverCount, signedIn }: { label: string; serverCount: number; signedIn: boolean }) {
  const [count, setCount] = useState(signedIn ? serverCount : 0);
  useEffect(() => {
    if (signedIn) return;
    const update = () => setCount(getLocalFavorites().length);
    update();
    return onFavoritesChange(update);
  }, [signedIn]);
  return (
    <Link href={signedIn ? "/minha-conta/favoritos" : "/favoritos"} className="relative inline-flex items-center gap-1.5 text-sm text-black transition-colors duration-150 hover:text-ink" aria-label={count ? `${label} (${count})` : label}>
      <Heart className="size-[18px]" strokeWidth={1.75} aria-hidden />
      <span className="hidden lg:inline">{label}</span>
      {count > 0 && <span className="tabular absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-black px-1 text-[10px] font-semibold text-white lg:static lg:ml-0.5">{count}</span>}
    </Link>
  );
}
