import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, PackageSearch, Tag } from "lucide-react";
import { pageLocale } from "@/i18n/page-locale";
import { Link } from "@/i18n/navigation";
import { getStoreContext } from "@/lib/data/context";
import { getHome } from "@/lib/data/home";
import { getPublicSettings, getStorefrontLocales } from "@/lib/data/settings";
import { getSessionUser } from "@/lib/auth/session";
import { getFavoriteIds } from "@/lib/data/favorites";
import { storagePublicUrl } from "@/lib/supabase/env";
import { recordEvent } from "@/lib/tracking/events";
import { CategoryIcon } from "@/components/category-icon";
import type { Metadata } from "next";
import { resolveLocaleParam } from "@/i18n/routing";
import { absoluteUrl, buildMetadata, siteUrl } from "@/lib/seo/metadata";
import { jsonLdScript } from "@/lib/seo/json-ld";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocaleParam((await params).locale) ?? "pt-BR";
  const s = await getPublicSettings();
  const seo = s.seo[locale] ?? s.seo["pt-BR"] ?? {};
  const t = await getTranslations({ locale, namespace: "home" });
  const meta = buildMetadata({ locale, locales: await getStorefrontLocales(), href: "/", title: seo.title || s.storeName, description: seo.description || t("heroSubtitle") });
  return { ...meta, title: { absolute: seo.title || s.storeName } };
}
import { ProductShelf, Section } from "@/components/store/product-grid";
import { HowToBuy, TrustBar } from "@/components/store/trust";
import { EmptyState } from "@/components/store/ui";
import { BannerCarousel } from "@/components/store/banner-carousel";
import { FlagshipHero } from "@/components/store/flagship-hero";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await pageLocale(params);
  const [ctx, t, tc, settings, user] = await Promise.all([getStoreContext(locale), getTranslations("home"), getTranslations("common"), getPublicSettings(), getSessionUser()]);
  const [home, favorites] = await Promise.all([getHome(locale, ctx.market), getFavoriteIds()]);
  await recordEvent({ type: "home_view", locale, market: ctx.market });
  const heroSrc = storagePublicUrl("site", settings.heroImage);
  const signedIn = !!user;

  const searchTarget = `${absoluteUrl(locale, "/produtos")}?q={search_term_string}`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: settings.storeName,
      url: siteUrl(),
      ...(settings.logoPath ? { logo: storagePublicUrl("site", settings.logoPath) } : {}),
      ...(ctx.businessModels.ownStore && settings.legal.company_name.trim() ? { legalName: settings.legal.company_name.trim() } : {}),
      ...(ctx.businessModels.ownStore && settings.contactEmail ? { email: settings.contactEmail } : {}),
    },
    { "@context": "https://schema.org", "@type": "WebSite", name: settings.storeName, url: absoluteUrl(locale, "/"), inLanguage: locale, potentialAction: { "@type": "SearchAction", target: searchTarget, "query-input": "required name=search_term_string" } },
  ];
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ld) }} />
      <div className="bg-soft">
        {home.flagship ? (
          <FlagshipHero flagship={home.flagship} locale={locale} storeName={settings.storeName} />
        ) : (
          <section className="shell grid items-center gap-10 pb-14 pt-12 md:grid-cols-12 md:pb-20 md:pt-20">
            <div className={heroSrc ? "md:col-span-7" : "md:col-span-10"}>
              <h1 className="text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.035em] text-black md:text-6xl">{t("heroTitle")}</h1>
              <p className="mt-5 max-w-xl text-lg text-mute">{t("heroSubtitle")}</p>
              <Link href="/produtos" className="btn btn-primary btn-lg mt-8">
                {t("heroCta")}
                <ArrowRight aria-hidden />
              </Link>
            </div>
            {heroSrc && (
              <div className="relative aspect-square overflow-hidden rounded-lg bg-white md:col-span-5">
                <Image src={heroSrc} alt="" fill priority sizes="(min-width: 768px) 40vw, 100vw" className="object-contain p-8" unoptimized={heroSrc.endsWith(".svg")} />
              </div>
            )}
          </section>
        )}
      </div>
      {ctx.businessModels.ownStore && <TrustBar />}

      {home.banners.length > 0 && (
        <div className="shell pt-8 md:pt-10">
          <BannerCarousel banners={home.banners} labels={{ previous: tc("previous"), next: tc("next") }} />
        </div>
      )}

      <Section title={t("mainCategories")}>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:gap-3 lg:grid-cols-6">
          {home.categories.map((c) => (
            <li key={c.slug}>
              <Link href={{ pathname: "/categoria/[slug]", params: { slug: c.slug } }} className={TILE}>
                <CategoryIcon name={c.icon} className="size-6" />
                <span className="text-xs font-medium leading-tight md:text-[13px]">{c.name}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/ofertas" className={TILE_DEALS}>
              <Tag className="size-6" strokeWidth={1.5} aria-hidden />
              <span className="text-xs font-semibold leading-tight md:text-[13px]">{t("dealsTile")}</span>
            </Link>
          </li>
        </ul>
      </Section>

      {!home.hasAnyProduct && (
        <section className="shell pb-16">
          <EmptyState icon={PackageSearch} title={t("comingSoonTitle")} text={t("comingSoonText")} />
        </section>
      )}

      {home.featured.length > 0 && (
        <Section title={t("featured")} subtitle={t("featuredSubtitle")} action={<SeeAll label={tc("seeAll")} />}>
          <ProductShelf products={home.featured} locale={locale} signedIn={signedIn} favorites={favorites} priorityCount={4} />
        </Section>
      )}

      {home.promotions.length > 0 && (
        <Section tone="soft" title={t("deals")} subtitle={t("dealsSubtitle")} action={<SeeAll label={tc("seeAll")} href="/ofertas" />}>
          <ProductShelf products={home.promotions} locale={locale} signedIn={signedIn} favorites={favorites} />
        </Section>
      )}

      {home.popular.length > 0 && (
        <Section title={t("popular")} subtitle={t("popularSubtitle")}>
          <ProductShelf products={home.popular} locale={locale} signedIn={signedIn} favorites={favorites} />
        </Section>
      )}

      {/* without images this would only repeat the category tiles above */}
      {home.hasAnyProduct && home.categories.some((c) => c.imagePath) && (
        <Section title={t("discover")}>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {home.categories.filter((c) => c.imagePath).map((c) => {
              const img = storagePublicUrl("categories", c.imagePath);
              return (
                <li key={c.slug}>
                  <Link href={{ pathname: "/categoria/[slug]", params: { slug: c.slug } }} className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-lg bg-soft p-4">
                    {img ? (
                      <Image src={img} alt="" fill sizes="(min-width: 768px) 20vw, 50vw" className="object-cover transition-transform duration-200 group-hover:scale-[1.02]" unoptimized={img.endsWith(".svg")} />
                    ) : (
                      <CategoryIcon name={c.icon} className="absolute right-4 top-4 size-7 text-mute" />
                    )}
                    <span className="relative rounded-sm bg-white px-2 py-1 text-sm font-semibold">{c.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {ctx.businessModels.ownStore && home.hasAnyProduct && <HowToBuy storeName={settings.storeName} />}

      {home.hasAnyProduct && (
        <section className="bg-soft">
          <div className="shell py-8 md:py-10">
            <div className="flex flex-col gap-5 rounded-lg bg-black p-6 text-white md:flex-row md:items-center md:justify-between md:p-10">
              <div className="min-w-0 max-w-2xl">
                <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-white md:text-3xl">{t("heroTitle")}</h2>
                <p className="mt-2 text-sm text-white/70 md:text-base">{t("heroSubtitle")}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <Link href="/produtos" className="btn btn-secondary btn-lg border-white">
                  {t("heroCta")}
                  <ArrowRight aria-hidden />
                </Link>
                <Link href="/ofertas" className="btn btn-lg border-white/40 bg-transparent text-white hover:bg-white/10">{t("dealsTile")}</Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

const TILE_BASE = "flex h-full flex-col items-center justify-center gap-2.5 rounded-lg border px-2 py-5 text-center transition-colors duration-150";
const TILE = `${TILE_BASE} border-line bg-white hover:border-black`;
const TILE_DEALS = `${TILE_BASE} border-black bg-black text-white hover:bg-ink`;

function SeeAll({ label, href = "/produtos" }: { label: string; href?: "/produtos" | "/ofertas" }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-black underline-offset-4 hover:underline">
      {label}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}
