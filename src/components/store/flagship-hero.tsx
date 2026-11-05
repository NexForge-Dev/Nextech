import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { FlagshipData } from "@/lib/data/home";
import { storagePublicUrl } from "@/lib/supabase/env";
import { AddToCart } from "./add-to-cart";
import { FlagshipCarousel } from "./flagship-carousel";
import { PriceView } from "./price";

/** Top of the home: one highlighted product, or a carousel from two up. Managed in Admin → Produtos. */
export async function FlagshipHero({ flagships, locale, storeName }: { flagships: FlagshipData[]; locale: Locale; storeName: string }) {
  const [t, tc] = await Promise.all([getTranslations("home"), getTranslations("common")]);
  if (flagships.length === 1) {
    return (
      <section data-testid="flagship-hero">
        <FlagshipSlide flagship={flagships[0]} locale={locale} storeName={storeName} first />
      </section>
    );
  }
  const slides = await Promise.all(flagships.map((f, i) => FlagshipSlide({ flagship: f, locale, storeName, first: i === 0 })));
  return (
    <FlagshipCarousel
      slides={slides}
      labels={{ region: t("flagshipCarousel"), previous: tc("previous"), next: tc("next"), goTo: flagships.map((f) => t("flagshipGoTo", { name: f.product.name })) }}
    />
  );
}

/** The first slide owns the page's h1 and the image preload. */
async function FlagshipSlide({ flagship, locale, storeName, first }: { flagship: FlagshipData; locale: Locale; storeName: string; first: boolean }) {
  const [t, tp, tcart] = await Promise.all([getTranslations("home"), getTranslations("product"), getTranslations("cart")]);
  const { product, shortDescription } = flagship;
  const src = storagePublicUrl("products", product.mainImage?.path);
  const href = { pathname: "/produto/[slug]", params: { slug: product.slug } } as const;
  const price = product.price;
  const buyable = product.saleMode === "own" && price.kind === "price";
  const Heading = first ? "h1" : "h2";
  return (
    <div className="shell grid grid-cols-1 items-center gap-6 pb-10 pt-6 md:grid-cols-12 md:gap-10 md:pb-16 md:pt-12">
      <div className="min-w-0 md:order-2 md:col-span-6">
        <Link href={href} className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-white md:aspect-square lg:aspect-[5/4]">
          {src ? (
            <Image src={src} alt={product.mainImage?.alt || product.name} fill priority={first} sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw" className="object-contain p-6 mix-blend-multiply md:p-10" unoptimized={src.endsWith(".svg")} />
          ) : (
            <span className="grid h-full place-items-center text-xs text-mute">{tp("noImage")}</span>
          )}
        </Link>
      </div>
      <div className="min-w-0 md:order-1 md:col-span-6">
        <p className="t-eyebrow">{t("flagshipEyebrow", { store: storeName })}</p>
        {product.brand && <p className="mt-4 text-sm font-medium text-black">{product.brand}</p>}
        <Heading className="t-display mt-1 break-words max-md:line-clamp-3">{product.name}</Heading>
        {shortDescription && <p className="mt-4 max-w-xl text-base text-mute md:text-lg">{shortDescription}</p>}
        <div className="mt-5 md:mt-6">
          <PriceView price={price} locale={locale} size="lg" />
        </div>
        {buyable && (
          <div className="mt-5 max-w-sm md:mt-6">
            <AddToCart productId={product.id} priceMinor={price.fromMinor} available={product.available} labels={{ addToCart: tp("addToCart"), buyNow: tp("buyNow"), soldOut: tp("soldOut"), added: tcart("added"), viewCart: tcart("viewCart") }} />
          </div>
        )}
        <Link href={href} className={`inline-flex min-h-11 items-center gap-1 text-sm font-medium text-black hover:underline md:min-h-0 ${buyable ? "mt-2 md:mt-4" : "mt-4 md:mt-6"}`}>
          {t("flagshipDetails")}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
