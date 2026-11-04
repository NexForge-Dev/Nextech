"use client";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { getLocalFavorites, onFavoritesChange, toggleLocalFavorite } from "@/lib/favorites-local";
import { toggleFavorite } from "@/actions/store/favorites";

export function FavoriteButton({ productId, signedIn, initial = false, className = "", withLabel = false }: { productId: string; signedIn: boolean; initial?: boolean; className?: string; withLabel?: boolean }) {
  const t = useTranslations("product");
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (signedIn) return;
    const sync = () => setFav(getLocalFavorites().includes(productId));
    const id = requestAnimationFrame(sync);
    const off = onFavoritesChange(sync);
    return () => {
      cancelAnimationFrame(id);
      off();
    };
  }, [productId, signedIn]);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      setFav(toggleLocalFavorite(productId));
      return;
    }
    const next = !fav;
    setFav(next);
    start(async () => {
      const r = await toggleFavorite(productId);
      if (!r.ok) setFav(!next);
      else setFav(r.favorited);
    });
  }

  const label = fav ? t("removeFavorite") : t("addFavorite");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={fav}
      aria-label={label}
      title={label}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 transition-colors duration-150 disabled:opacity-60 ${className}`}
    >
      <Heart className="size-[18px] shrink-0" strokeWidth={1.75} fill={fav ? "currentColor" : "none"} aria-hidden />
      {withLabel && <span className="text-sm">{label}</span>}
    </button>
  );
}
