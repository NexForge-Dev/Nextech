import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Tag } from "lucide-react";
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
import { ProductGrid, Section } from "@/components/store/product-grid";
import { BannerCarousel } from "@/components/store/banner-carousel";

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
      <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pb-12 pt-14 md:grid-cols-12 md:px-6 md:pb-20 md:pt-24">
        <div className={heroSrc ? "md:col-span-7" : "md:col-span-10"}>
          <h1 className="text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.035em] text-black md:text-6xl lg:text-7xl">{t("heroTitle")}</h1>
          <p className="mt-6 max-w-xl text-lg text-mute md:text-xl">{t("heroSubtitle")}</p>
          <Link href="/produtos" className="mt-10 inline-flex h-12 items-center gap-2 rounded-md bg-black px-6 text-[0.95rem] font-medium text-white transition-colors duration-150 hover:bg-ink">
            {t("heroCta")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {heroSrc && (
          <div className="relative aspect-square overflow-hidden rounded-md bg-soft md:col-span-5">
            <Image src={heroSrc} alt="" fill priority sizes="(min-width: 768px) 40vw, 100vw" className="object-contain p-8" unoptimized={heroSrc.endsWith(".svg")} />
          </div>
        )}
      </section>

      {home.banners.length > 0 && (
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <BannerCarousel banners={home.banners} labels={{ previous: tc("previous"), next: tc("next") }} />
        </div>
      )}

      <Section title={t("mainCategories")}>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11">
          {home.categories.map((c) => (
            <li key={c.slug}>
              <Link href={{ pathname: "/categoria/[slug]", params: { slug: c.slug } }} className="flex h-full flex-col items-center gap-3 rounded-md px-2 py-5 text-center transition-colors duration-150 hover:bg-soft">
                <CategoryIcon name={c.icon} className="size-6 text-black" />
                <span className="text-xs font-medium leading-tight">{c.name}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/ofertas" className="flex h-full flex-col items-center gap-3 rounded-md px-2 py-5 text-center transition-colors duration-150 hover:bg-soft">
              <Tag className="size-6 text-black" strokeWidth={1.5} aria-hidden />
              <span className="text-xs font-medium leading-tight">{t("dealsTile")}</span>
            </Link>
          </li>
        </ul>
      </Section>

      {!home.hasAnyProduct && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-16 md:px-6">
          <div className="rounded-md border border-line px-6 py-14 text-center">
            <p className="text-xl font-semibold tracking-tight">{t("comingSoonTitle")}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-mute">{t("comingSoonText")}</p>
          </div>
        </section>
      )}

      {home.featured.length > 0 && (
        <Section title={t("featured")} subtitle={t("featuredSubtitle")} action={<SeeAll label={tc("seeAll")} />}>
          <ProductGrid products={home.featured} locale={locale} signedIn={signedIn} favorites={favorites} priorityCount={4} />
        </Section>
      )}

      {home.promotions.length > 0 && (
        <Section title={t("deals")} subtitle={t("dealsSubtitle")} action={<SeeAll label={tc("seeAll")} href="/ofertas" />}>
          <ProductGrid products={home.promotions} locale={locale} signedIn={signedIn} favorites={favorites} />
        </Section>
      )}

      {home.popular.length > 0 && (
        <Section title={t("popular")} subtitle={t("popularSubtitle")}>
          <ProductGrid products={home.popular} locale={locale} signedIn={signedIn} favorites={favorites} />
        </Section>
      )}

      {home.hasAnyProduct && (
        <Section title={t("discover")}>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {home.categories.map((c) => {
              const img = storagePublicUrl("categories", c.imagePath);
              return (
                <li key={c.slug}>
                  <Link href={{ pathname: "/categoria/[slug]", params: { slug: c.slug } }} className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-md bg-soft p-4">
                    {img ? (
                      <Image src={img} alt="" fill sizes="(min-width: 768px) 20vw, 50vw" className="object-cover transition-transform duration-200 group-hover:scale-[1.02]" unoptimized={img.endsWith(".svg")} />
                    ) : (
                      <CategoryIcon name={c.icon} className="absolute right-4 top-4 size-7 text-mute" />
                    )}
                    <span className={`relative text-sm font-semibold ${img ? "rounded-sm bg-white px-2 py-1" : ""}`}>{c.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </main>
  );
}

function SeeAll({ label, href = "/produtos" }: { label: string; href?: "/produtos" | "/ofertas" }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-black hover:underline">
      {label}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}
