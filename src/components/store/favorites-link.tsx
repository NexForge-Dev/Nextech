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
    <Link href={signedIn ? "/minha-conta/favoritos" : "/favoritos"} className="relative inline-flex h-10 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-black transition-colors duration-150 hover:bg-soft" aria-label={count ? `${label} (${count})` : label}>
      <Heart className="size-5" strokeWidth={1.75} aria-hidden />
      <span className="hidden xl:inline">{label}</span>
      {count > 0 && <span className="tabular absolute left-6 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-black px-1 text-[10px] font-semibold text-white ring-2 ring-white xl:static xl:ring-0">{count}</span>}
    </Link>
  );
}
