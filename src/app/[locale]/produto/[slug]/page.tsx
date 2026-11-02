import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ExternalLink, Star } from "lucide-react";
import { pageLocale } from "@/i18n/page-locale";
import { Link } from "@/i18n/navigation";
import { resolveLocaleParam } from "@/i18n/routing";
import { getStoreContext } from "@/lib/data/context";
import { getProduct, getRelated } from "@/lib/data/product";
import { getFavoriteIds } from "@/lib/data/favorites";
import { getSessionUser } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { storagePublicUrl } from "@/lib/supabase/env";
import { bestOffer, displayPrice, priceSummary } from "@/lib/domain/pricing";
import { formatMoney } from "@/lib/domain/money";
import { renderMarkdownSafe, stripTags } from "@/lib/security/sanitize";
import { jsonLdScript, productJsonLd } from "@/lib/seo/json-ld";
import { recordEvent } from "@/lib/tracking/events";
import { absoluteUrl, buildMetadata } from "@/lib/seo/metadata";
import { Gallery } from "@/components/store/gallery";
import { PriceView } from "@/components/store/price";
import { FavoriteButton } from "@/components/store/favorite-button";
import { ProductGrid, Section } from "@/components/store/product-grid";
import { AddToCart } from "@/components/store/add-to-cart";
import { ownDiscountPct, pixPriceMinor } from "@/lib/domain/own-pricing";
import { getPublicSettings, getStorefrontLocales } from "@/lib/data/settings";

type Props = { params: Promise<{ locale: string; slug: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3300";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const locale = resolveLocaleParam(p.locale) ?? "pt-BR";
  const product = await getProduct(p.slug, locale);
  if (!product) return {};
  const description = stripTags(product.shortDescription ?? product.descriptionMd ?? "").slice(0, 160) || undefined;
  return buildMetadata({ locale, locales: await getStorefrontLocales(), href: { pathname: "/produto/[slug]", params: { slug: product.slug } }, title: product.name, description, type: "article" });
}

export default async function ProductPage({ params }: Props) {
  const locale = await pageLocale(params);
  const { slug } = await params;
  const product = await getProduct(slug, locale);
  if (!product) notFound();

  const [ctx, t, tcat, tm, format, user, favorites, tcart, settings] = await Promise.all([
    getStoreContext(locale),
    getTranslations("product"),
    getTranslations("catalog"),
    getTranslations("markets"),
    getFormatter(),
    getSessionUser(),
    getFavoriteIds(),
    getTranslations("cart"),
    getPublicSettings(),
  ]);
  const own = product.saleMode === "own" ? product.sale : null;
  const ownDiscount = own ? ownDiscountPct(own) : null;
  const pixOn = ctx.businessModels.payments.pix && !!own && own.pixDiscountPct > 0;
  const now = new Date();
  const market = ctx.market;
  const summary = priceSummary(product.offers, market, now);
  const best = bestOffer(product.offers, market, now);
  const marketOffers = product.offers
    .filter((o) => o.market === market)
    .sort((a, b) => (displayPrice(a, now) ?? Number.MAX_SAFE_INTEGER) - (displayPrice(b, now) ?? Number.MAX_SAFE_INTEGER));
  const others = marketOffers.filter((o) => o.id !== best?.id);
  const marketName = (code: string) => (tm.has(code as "BR") ? tm(code as "BR") : code);
  const goHref = (offerId: string) => `/go/${product.id}?offer=${offerId}`;
  const ctaLabel = (o: (typeof product.offers)[number]) => (displayPrice(o, now) == null ? t("seePriceAt", { store: o.storeName }) : t("viewOnStore"));
  const images = product.images.map((i) => ({ src: storagePublicUrl("products", i.path)!, alt: i.alt }));

  await recordEvent({ type: "product_view", productId: product.id, locale, market });
  if (user) {
    const sb = await createServerSupabase();
    // RLS only accepts the insert when the user enabled browsing history
    await sb.from("browsing_history").insert({ user_id: user.id, product_id: product.id });
  }
  const related = await getRelated(product, locale, market);
  const url = absoluteUrl(locale, { pathname: "/produto/[slug]", params: { slug: product.slug } });
  const ld = productJsonLd(
    {
      name: product.name,
      description: product.shortDescription,
      brand: product.brand?.name ?? null,
      sku: product.sku,
      images: images.map((i) => i.src),
      rating: product.rating,
      offers: own
        ? [{ id: product.id, market: "BR", currency: "BRL", active: own.available, policy: "show" as const, priceMinor: own.priceMinor, priceUpdatedAt: now.toISOString(), previousPriceMinor: null, previousVerified: false, priceSource: "manual" as const, requiresFreshIntegration: false, history: [], storeName: settings.storeName, url }]
        : marketOffers.map((o) => ({ ...o, url: `${SITE}${goHref(o.id)}` })),
    },
    url,
    now,
    !!product.rating,
  );

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ld) }} />
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 md:px-6">
        <nav aria-label="breadcrumb" className="text-xs text-mute">
          <Link href="/produtos" className="hover:text-black">{tcat("title")}</Link>
          <span className="mx-2">/</span>
          <Link href={{ pathname: "/categoria/[slug]", params: { slug: product.category.slug } }} className="hover:text-black">{product.category.name}</Link>
        </nav>
      </div>
      <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 pb-16 pt-6 md:px-6 lg:grid-cols-2 lg:gap-16">
        <Gallery images={images} name={product.name} />
        <div className="flex flex-col">
          {product.brand && (
            <Link href={{ pathname: "/produtos", query: { brand: product.brand.slug } }} className="text-xs font-medium uppercase tracking-wider text-mute hover:text-black">
              {product.brand.name}
            </Link>
          )}
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{product.name}</h1>
          {product.rating && (
            <p className="mt-3 flex items-center gap-2 text-sm text-mute">
              <Star className="size-4 fill-black text-black" aria-hidden />
              <span className="font-medium text-black">{t("rating", { value: product.rating.value.toFixed(1) })}</span>
              {product.rating.count != null && <span>· {t("ratingCount", { count: product.rating.count })}</span>}
              <span>· {t("ratingSource", { source: product.rating.source })}</span>
            </p>
          )}
          {product.shortDescription && <p className="mt-4 text-mute">{product.shortDescription}</p>}

          {own ? (
            <div className="mt-8 border-t border-line pt-8" data-testid="own-buy-box">
              {ownDiscount != null && own.compareAtMinor != null && (
                <p className="tabular text-sm text-mute line-through">{formatMoney(own.compareAtMinor, "BRL", locale)}</p>
              )}
              <p className="flex items-center gap-3">
                <span className="tabular text-4xl font-semibold tracking-tight" data-testid="price-main">{formatMoney(own.priceMinor, "BRL", locale)}</span>
                {ownDiscount != null && <span className="rounded-full bg-black px-2 py-0.5 text-xs font-semibold text-white">-{ownDiscount}%</span>}
              </p>
              <p className="mt-1 text-sm text-mute">{t("cardOrBoleto")}</p>
              {pixOn && (
                <p className="mt-1 text-sm">
                  <strong className="tabular">{t("pixPrice", { price: formatMoney(pixPriceMinor(own.priceMinor, own.pixDiscountPct), "BRL", locale) })}</strong>{" "}
                  <span className="rounded-full border border-black px-2 py-0.5 text-xs font-medium">{t("pixOff", { pct: own.pixDiscountPct })}</span>
                </p>
              )}
              <ul className="mt-5 space-y-1 text-sm">
                <li>✓ {t("freeShipping", { min: own.deliveryMinDays, max: own.deliveryMaxDays })}</li>
                <li>{own.available ? `✓ ${t("inStock")}` : t("soldOut")}</li>
              </ul>
              {market === "BR" ? (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    <AddToCart
                      productId={product.id}
                      priceMinor={own.priceMinor}
                      available={own.available}
                      labels={{ addToCart: t("addToCart"), buyNow: t("buyNow"), soldOut: t("soldOut"), added: tcart("added"), viewCart: tcart("viewCart") }}
                    />
                  </div>
                  <FavoriteButton productId={product.id} signedIn={!!user} initial={favorites.has(product.id)} withLabel className="h-12 rounded-md border border-line px-5 hover:bg-soft" />
                </div>
              ) : (
                <p className="mt-6 text-sm font-medium">{t("onlyBrazil")}</p>
              )}
              <p className="mt-5 text-xs text-mute">{t("ownSeller")}</p>
            </div>
          ) : (
          <div className="mt-8 border-t border-line pt-8">
            <PriceView price={summary} locale={locale} size="lg" />
            {summary.kind === "unavailable" ? (
              <div className="mt-4 space-y-1 text-sm">
                <p className="text-mute">{t("notInCountryText", { country: marketName(market) })}</p>
                {summary.availableMarkets.length > 0 && <p>{t("availableIn", { markets: summary.availableMarkets.map(marketName).join(", ") })}</p>}
              </div>
            ) : (
              best && (
                <>
                  <p className="mt-2 text-sm text-mute">
                    {t("store")}: <span className="text-black">{best.storeName}</span>
                    {displayPrice(best, now) != null && best.priceUpdatedAt && <> · {t("priceUpdated", { date: format.dateTime(new Date(best.priceUpdatedAt), { dateStyle: "medium" }) })}</>}
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <a
                      href={goHref(best.id)}
                      rel="nofollow sponsored noopener"
                      target="_blank"
                      className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-black px-6 text-sm font-semibold tracking-wide text-white transition-colors duration-150 hover:bg-ink"
                    >
                      {ctaLabel(best)}
                      <ExternalLink className="size-4" aria-hidden />
                    </a>
                    <FavoriteButton productId={product.id} signedIn={!!user} initial={favorites.has(product.id)} withLabel className="h-12 rounded-md border border-line px-5 hover:bg-soft" />
                  </div>
                </>
              )
            )}
            <p className="mt-5 text-xs text-mute">{t("purchaseNote")}</p>
            <p className="mt-2 text-xs text-mute">
              {t("affiliateNotice")}{" "}
              <Link href="/afiliados" className="text-black underline underline-offset-2">{t("learnMore")}</Link>
            </p>
          </div>
          )}

          {others.length > 0 && (
            <div className="mt-8 border-t border-line pt-6">
              <h2 className="text-sm font-semibold">{t("otherOffers")}</h2>
              <ul className="mt-3 divide-y divide-line">
                {others.map((o) => {
                  const price = displayPrice(o, now);
                  return (
                    <li key={o.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <span>{o.storeName}</span>
                      <span className="flex items-center gap-4">
                        {price != null && <span className="tabular font-semibold">{formatMoney(price, o.currency, locale)}</span>}
                        <a href={goHref(o.id)} rel="nofollow sponsored noopener" target="_blank" className="inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 text-xs font-medium hover:bg-soft">
                          {price == null ? t("seePriceAt", { store: o.storeName }) : t("seeProduct")}
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </section>

      {(product.descriptionMd || product.specs.length > 0) && (
        <section className="mx-auto grid w-full max-w-7xl gap-12 border-t border-line px-4 py-14 md:px-6 lg:grid-cols-2">
          {product.descriptionMd && (
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{t("description")}</h2>
              <div className="prose-nx mt-4 space-y-3 text-[15px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(product.descriptionMd) }} />
            </div>
          )}
          {product.specs.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{t("specs")}</h2>
              <dl className="mt-4 divide-y divide-line border-y border-line">
                {product.specs.map((s) => (
                  <div key={s.label} className="grid grid-cols-2 gap-4 py-3 text-sm">
                    <dt className="text-mute">{s.label}</dt>
                    <dd className="text-black">{s.value}</dd>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4 py-3 text-sm">
                  <dt className="text-mute">{t("category")}</dt>
                  <dd>{product.category.name}</dd>
                </div>
              </dl>
            </div>
          )}
        </section>
      )}

      {related.length > 0 && (
        <Section title={t("related")}>
          <ProductGrid products={related.slice(0, 4)} locale={locale} signedIn={!!user} favorites={favorites} />
        </Section>
      )}
    </main>
  );
}
