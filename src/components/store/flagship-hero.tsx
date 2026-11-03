import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { FlagshipData } from "@/lib/data/home";
import { storagePublicUrl } from "@/lib/supabase/env";
import { AddToCart } from "./add-to-cart";
import { PriceView } from "./price";

/** Top-of-home spotlight for the product picked in Configurações → Loja. */
export async function FlagshipHero({ flagship, locale, storeName }: { flagship: FlagshipData; locale: Locale; storeName: string }) {
  const [t, tp, tcart] = await Promise.all([getTranslations("home"), getTranslations("product"), getTranslations("cart")]);
  const { product, shortDescription } = flagship;
  const src = storagePublicUrl("products", product.mainImage?.path);
  const href = { pathname: "/produto/[slug]", params: { slug: product.slug } } as const;
  const price = product.price;
  const buyable = product.saleMode === "own" && price.kind === "price";
  return (
    <section data-testid="flagship-hero" className="mx-auto grid w-full max-w-7xl items-center gap-8 px-4 pb-12 pt-10 md:grid-cols-12 md:gap-10 md:px-6 md:pb-20 md:pt-20">
      <div className="md:order-2 md:col-span-6">
        <Link href={href} className="relative block aspect-square overflow-hidden rounded-md bg-soft">
          {src ? (
            <Image src={src} alt={product.mainImage?.alt || product.name} fill priority sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw" className="object-contain p-8 mix-blend-multiply md:p-12" unoptimized={src.endsWith(".svg")} />
          ) : (
            <span className="grid h-full place-items-center text-xs text-mute">{tp("noImage")}</span>
          )}
        </Link>
      </div>
      <div className="md:order-1 md:col-span-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-mute">{t("flagshipEyebrow", { store: storeName })}</p>
        {product.brand && <p className="mt-5 text-sm font-medium text-black">{product.brand}</p>}
        <h1 className="mt-1 text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.03em] text-black md:text-5xl">{product.name}</h1>
        {shortDescription && <p className="mt-5 max-w-xl text-lg text-mute">{shortDescription}</p>}
        <div className="mt-7">
          <PriceView price={price} locale={locale} size="lg" />
        </div>
        {buyable && (
          <div className="mt-6 max-w-sm">
            <AddToCart productId={product.id} priceMinor={price.fromMinor} available={product.available} labels={{ addToCart: tp("addToCart"), buyNow: tp("buyNow"), soldOut: tp("soldOut"), added: tcart("added"), viewCart: tcart("viewCart") }} />
          </div>
        )}
        <Link href={href} className={`inline-flex items-center gap-1 text-sm font-medium text-black hover:underline ${buyable ? "mt-4" : "mt-6"}`}>
          {t("flagshipDetails")}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
