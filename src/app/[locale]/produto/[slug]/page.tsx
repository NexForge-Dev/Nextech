import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronRight, CircleCheck, CircleSlash, ExternalLink, Lock, RotateCcw, ShieldCheck, Star, Truck } from "lucide-react";
import { pageLocale } from "@/i18n/page-locale";
import { Link } from "@/i18n/navigation";
import { resolveLocaleParam } from "@/i18n/routing";
import { getStoreContext } from "@/lib/data/context";
import { getProduct, getRelated } from "@/lib/data/product";
import { getFavoriteIds } from "@/lib/data/favorites";
import { getSessionUser } from "@/lib/auth/session";
import { releaseExpiredHolds } from "@/lib/orders/expire";
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
import { ProductShelf, Section } from "@/components/store/product-grid";
import { AddToCart } from "@/components/store/add-to-cart";
import { ownDiscountPct, pixPriceMinor } from "@/lib/domain/own-pricing";
import { PromoCountdown } from "@/components/store/promo-countdown";
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

  const [ctx, t, tcat, tm, format, user, favorites, tcart, settings, ts] = await Promise.all([
    getStoreContext(locale),
    getTranslations("product"),
    getTranslations("catalog"),
    getTranslations("markets"),
    getFormatter(),
    getSessionUser(),
    getFavoriteIds(),
    getTranslations("cart"),
    getPublicSettings(),
    getTranslations("store"),
  ]);
  const crumb = "inline-flex min-h-11 items-center hover:text-black md:min-h-0";
  const own = product.saleMode === "own" ? product.sale : null;
  // sold out may only mean units held by an unpaid order that already expired
  if (own?.fulfillment === "stock" && !own.available) after(() => releaseExpiredHolds());
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
      <div className="shell pt-4 md:pt-6">
        <nav aria-label={ts("breadcrumb")} className="flex flex-wrap items-center gap-1.5 text-xs text-mute">
          <Link href="/" className={crumb}>{ts("home")}</Link>
          <ChevronRight className="size-3" aria-hidden />
          <Link href="/produtos" className={crumb}>{tcat("title")}</Link>
          <ChevronRight className="size-3" aria-hidden />
          <Link href={{ pathname: "/categoria/[slug]", params: { slug: product.category.slug } }} className={crumb}>{product.category.name}</Link>
        </nav>
      </div>
      <section className="shell grid items-start gap-6 pb-10 pt-4 md:pt-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
        <Gallery images={images} name={product.name} />
        <div className="flex min-w-0 flex-col lg:sticky lg:top-44">
          {product.brand && (
            <Link href={{ pathname: "/produtos", query: { brand: product.brand.slug } }} className="t-eyebrow hover:text-black">
              {product.brand.name}
            </Link>
          )}
          <h1 className="t-page mt-1.5 break-words">{product.name}</h1>
          {product.rating && (
            <p className="mt-3 flex items-center gap-2 text-sm text-mute">
              <Star className="size-4 fill-black text-black" aria-hidden />
              <span className="font-medium text-black">{t("rating", { value: product.rating.value.toFixed(1) })}</span>
              {product.rating.count != null && <span>· {t("ratingCount", { count: product.rating.count })}</span>}
              <span>· {t("ratingSource", { source: product.rating.source })}</span>
            </p>
          )}
          {product.shortDescription && <p className="mt-3 text-[15px] text-mute">{product.shortDescription}</p>}

          {own ? (
            <div className="panel mt-5 p-5" data-testid="own-buy-box">
              {own.promoEndsAt && <PromoCountdown endsAt={own.promoEndsAt} label={t("promoEndsIn")} className="mb-4" />}
              {ownDiscount != null && own.compareAtMinor != null && (
                <p className="flex items-center gap-2 text-sm">
                  <span className="tabular text-mute line-through">{formatMoney(own.compareAtMinor, "BRL", locale)}</span>
                  <span className="rounded-sm bg-black px-1.5 py-0.5 text-[11px] font-semibold text-white">-{ownDiscount}%</span>
                </p>
              )}
              <p className="tabular text-3xl font-semibold tracking-tight md:text-4xl" data-testid="price-main">{formatMoney(own.priceMinor, "BRL", locale)}</p>
              {(ctx.businessModels.payments.card || ctx.businessModels.payments.boleto) && (
                <p className="mt-1 text-sm text-mute">
                  {ctx.businessModels.payments.card && ctx.businessModels.payments.boleto ? t("cardOrBoleto") : ctx.businessModels.payments.card ? t("cardOnly") : t("boletoOnly")}
                </p>
              )}
              {pixOn && (
                <p className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-soft px-3 py-2 text-sm">
                  <strong className="tabular">{t("pixPrice", { price: formatMoney(pixPriceMinor(own.priceMinor, own.pixDiscountPct), "BRL", locale) })}</strong>
                  <span className="tag h-5 px-2">{t("pixOff", { pct: own.pixDiscountPct })}</span>
                </p>
              )}
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2"><Truck className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />{t("freeShipping", { min: own.deliveryMinDays, max: own.deliveryMaxDays })}</li>
                <li className="flex items-center gap-2 font-medium">
                  {own.available ? <CircleCheck className="size-4 shrink-0" strokeWidth={1.75} aria-hidden /> : <CircleSlash className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />}
                  {!own.available ? t("soldOut") : own.fulfillment === "stock" ? t("inStock") : t("availableNow")}
                </li>
              </ul>
              {market === "BR" ? (
                <div className="mt-5 space-y-2">
                  <div>
                    <AddToCart
                      productId={product.id}
                      priceMinor={own.priceMinor}
                      available={own.available}
                      labels={{ addToCart: t("addToCart"), buyNow: t("buyNow"), soldOut: t("soldOut"), added: tcart("added"), viewCart: tcart("viewCart") }}
                    />
                  </div>
                  <FavoriteButton productId={product.id} signedIn={!!user} initial={favorites.has(product.id)} withLabel className="btn btn-ghost btn-lg w-full font-medium" />
                </div>
              ) : (
                <p className="mt-5 text-sm font-medium">{t("onlyBrazil")}</p>
              )}
              <p className="mt-4 border-t border-line pt-4 text-xs text-mute">{t("ownSeller", { store: settings.storeName })}</p>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-mute">
                <li className="flex items-center gap-1.5"><Lock className="size-3.5" strokeWidth={1.75} aria-hidden />{ts("securePayment")}</li>
                <li className="flex items-center gap-1.5"><RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />{ts("withdrawal")}</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" strokeWidth={1.75} aria-hidden />{product.warranty ? ts("warrantyValue", { value: product.warranty }) : ts("warranty")}</li>
              </ul>
            </div>
          ) : (
          <div className="panel mt-5 p-5">
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
                      className="btn btn-primary btn-lg flex-1"
                    >
                      {ctaLabel(best)}
                      <ExternalLink className="size-4" aria-hidden />
                    </a>
                    <FavoriteButton productId={product.id} signedIn={!!user} initial={favorites.has(product.id)} withLabel className="btn btn-secondary btn-lg font-medium" />
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
                        <a href={goHref(o.id)} rel="nofollow sponsored noopener" target="_blank" className="btn btn-secondary btn-sm">
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
        <section className="shell grid items-start gap-4 pb-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
          {product.descriptionMd && (
            <div className="panel min-w-0 p-5 md:p-6">
              <h2 className="t-section">{t("description")}</h2>
              <div className="prose-nx mt-4 space-y-3 text-[15px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(product.descriptionMd) }} />
            </div>
          )}
          {product.specs.length > 0 && (
            <div className="panel min-w-0 p-5 md:p-6">
              <h2 className="t-section">{t("specs")}</h2>
              <dl className="mt-3 divide-y divide-line">
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
          <ProductShelf products={related} locale={locale} signedIn={!!user} favorites={favorites} />
        </Section>
      )}
    </main>
  );
}
