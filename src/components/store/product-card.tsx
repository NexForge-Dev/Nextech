import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ImageOff, Star, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ProductCardData } from "@/lib/data/catalog";
import { storagePublicUrl } from "@/lib/supabase/env";
import { PriceView } from "./price";
import { FavoriteButton } from "./favorite-button";

export async function ProductCard({ product, locale, signedIn, favorite = false, priority = false, note, cta }: { product: ProductCardData; locale: Locale; signedIn: boolean; favorite?: boolean; priority?: boolean; note?: string | null; cta?: { href: string; label: string } }) {
  const [t, ts] = await Promise.all([getTranslations("product"), getTranslations("store")]);
  const src = storagePublicUrl("products", product.mainImage?.path);
  const discount = product.price.kind === "price" ? product.price.discount : null;
  return (
    <article data-testid="product-card" className="group panel relative flex flex-col overflow-hidden transition-[border-color,box-shadow] duration-150 hover:border-mute hover:shadow-[var(--shadow-card)]">
      <Link href={{ pathname: "/produto/[slug]", params: { slug: product.slug } }} className="flex flex-1 flex-col">
        <div className="relative aspect-square overflow-hidden bg-white">
          {src ? (
            <Image
              src={src}
              alt={product.mainImage?.alt || product.name}
              fill
              sizes="(min-width: 1280px) 290px, (min-width: 768px) 30vw, 50vw"
              className={`object-contain p-4 transition-transform duration-200 group-hover:scale-[1.03] md:p-6 ${product.available ? "" : "opacity-50"}`}
              priority={priority}
              unoptimized={src.endsWith(".svg")}
            />
          ) : (
            <div className="grid h-full place-items-center bg-soft text-mute">
              <ImageOff className="size-6" strokeWidth={1.5} aria-hidden />
              <span className="sr-only">{t("noImage")}</span>
            </div>
          )}
          <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
            {discount != null && <span className="rounded-sm bg-black px-1.5 py-0.5 text-[11px] font-semibold text-white">{t("discount", { percent: discount })}</span>}
            {!product.available && <span className="rounded-sm border border-line bg-white px-1.5 py-0.5 text-[11px] font-semibold text-black">{t("soldOut")}</span>}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 border-t border-line p-3 md:p-4">
          {product.brand && <p className="t-eyebrow truncate">{product.brand}</p>}
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-5 text-black group-hover:underline group-hover:underline-offset-2">{product.name}</h3>
          {product.rating && (
            <p className="flex items-center gap-1 text-xs text-mute">
              <Star className="size-3 fill-black text-black" aria-hidden />
              <span className="tabular text-black">{product.rating.value.toFixed(1)}</span>
              {product.rating.count != null && <span>({product.rating.count})</span>}
              <span className="sr-only">{t("ratingSource", { source: product.rating.source })}</span>
            </p>
          )}
          {note && <p className="text-xs font-medium text-black">{note}</p>}
          <div className="mt-auto pt-2">
            <PriceView price={product.price} locale={locale} hideDiscount />
            {product.saleMode === "own" && product.available && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-mute">
                <Truck className="size-3.5" strokeWidth={1.75} aria-hidden />
                {ts("freeShipping")}
              </p>
            )}
          </div>
        </div>
      </Link>
      {cta && (
        <div className="px-3 pb-3 md:px-4 md:pb-4">
          <a href={cta.href} rel="nofollow sponsored noopener" target="_blank" className="btn btn-primary btn-sm w-full">
            {cta.label}
          </a>
        </div>
      )}
      <FavoriteButton productId={product.id} signedIn={signedIn} initial={favorite} className="absolute right-1.5 top-1.5 size-10 rounded-full text-black hover:bg-soft" />
    </article>
  );
}
