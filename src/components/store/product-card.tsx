import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ProductCardData } from "@/lib/data/catalog";
import { storagePublicUrl } from "@/lib/supabase/env";
import { PriceView } from "./price";
import { FavoriteButton } from "./favorite-button";

export async function ProductCard({ product, locale, signedIn, favorite = false, priority = false, note, cta }: { product: ProductCardData; locale: Locale; signedIn: boolean; favorite?: boolean; priority?: boolean; note?: string | null; cta?: { href: string; label: string } }) {
  const t = await getTranslations("product");
  const src = storagePublicUrl("products", product.mainImage?.path);
  return (
    <article data-testid="product-card" className="group relative flex flex-col">
      <Link href={{ pathname: "/produto/[slug]", params: { slug: product.slug } }} className="flex flex-1 flex-col" aria-label={`${t("seeProduct")}: ${product.name}`}>
        <div className="relative aspect-square overflow-hidden rounded-md bg-soft">
          {src ? (
            <Image
              src={src}
              alt={product.mainImage?.alt || product.name}
              fill
              sizes="(min-width: 1280px) 280px, (min-width: 768px) 30vw, 50vw"
              className="object-contain p-6 transition-transform duration-200 group-hover:scale-[1.02]"
              priority={priority}
              unoptimized={src.endsWith(".svg")}
            />
          ) : (
            <div className="grid h-full place-items-center text-xs text-mute">{t("noImage")}</div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 pt-3">
          {product.brand && <p className="text-[11px] font-medium uppercase tracking-wider text-mute">{product.brand}</p>}
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-black">{product.name}</h3>
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
            <PriceView price={product.price} locale={locale} />
          </div>
        </div>
      </Link>
      {cta && (
        <a href={cta.href} rel="nofollow sponsored noopener" target="_blank" className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-black px-3 text-xs font-semibold tracking-wide text-white transition-colors duration-150 hover:bg-ink">
          {cta.label}
        </a>
      )}
      <FavoriteButton productId={product.id} signedIn={signedIn} initial={favorite} className="absolute right-2 top-2 size-9 rounded-full bg-white/90 text-black hover:bg-white" />
    </article>
  );
}
