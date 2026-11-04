import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page-locale";
import { resolveLocaleParam } from "@/i18n/routing";
import { getStoreContext } from "@/lib/data/context";
import { getCampaign } from "@/lib/data/promotions";
import { getFavoriteIds } from "@/lib/data/favorites";
import { getSessionUser } from "@/lib/auth/session";
import { ProductGrid, Section } from "@/components/store/product-grid";
import { BannerCarousel } from "@/components/store/banner-carousel";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStorefrontLocales } from "@/lib/data/settings";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const locale = resolveLocaleParam(p.locale) ?? "pt-BR";
  const ctx = await getStoreContext(locale);
  const c = await getCampaign(p.slug, locale, ctx.market);
  return c ? buildMetadata({ locale, locales: await getStorefrontLocales(), href: { pathname: "/campanha/[slug]", params: { slug: c.slug } }, title: c.title, description: c.description }) : {};
}

export default async function CampaignPage({ params }: Props) {
  const locale = await pageLocale(params);
  const { slug } = await params;
  const ctx = await getStoreContext(locale);
  const campaign = await getCampaign(slug, locale, ctx.market);
  if (!campaign) notFound();
  const [t, tp, tc, format, user, favorites] = await Promise.all([getTranslations("campaign"), getTranslations("product"), getTranslations("common"), getFormatter(), getSessionUser(), getFavoriteIds()]);
  const ctas = new Map(
    campaign.products
      .filter((p) => p.saleMode === "affiliate" && p.price.kind !== "unavailable")
      .map((p) => [p.id, { href: `/go/${p.id}?c=${campaign.slug}`, label: p.price.kind === "link_only" ? tp("seePriceOnStore") : tp("viewOnStore") }]),
  );
  return (
    <main>
      <header className="bg-black text-white">
        <div className="shell py-10 md:py-14">
          <h1 className="t-display text-white">{campaign.title}</h1>
          {campaign.description && <p className="mt-3 max-w-2xl text-white/70 md:text-lg">{campaign.description}</p>}
          {campaign.endsAt && <p className="mt-3 text-sm text-white/70">{t("until", { date: format.dateTime(new Date(campaign.endsAt), { dateStyle: "long" }) })}</p>}
        </div>
      </header>
      {campaign.banners.length > 0 && (
        <div className="shell pt-8">
          <BannerCarousel banners={campaign.banners} labels={{ previous: tc("previous"), next: tc("next") }} />
        </div>
      )}
      {campaign.products.length > 0 && (
        <Section title={t("products")}>
          <ProductGrid products={campaign.products} locale={locale} signedIn={!!user} favorites={favorites} ctas={ctas} priorityCount={4} />
        </Section>
      )}
    </main>
  );
}
