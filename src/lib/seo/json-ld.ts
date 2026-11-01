import { displayPrice, type OfferForPricing } from "@/lib/domain/pricing";
import { minorDigits } from "@/lib/domain/money";

export type JsonLdProductInput = {
  name: string;
  description: string | null;
  brand: string | null;
  sku: string | null;
  images: string[];
  rating: { value: number; count: number | null } | null;
  offers: (OfferForPricing & { storeName: string; url: string })[];
};

function decimal(minor: number, currency: string): string {
  const d = minorDigits(currency);
  return (minor / 10 ** d).toFixed(d);
}

/** schema.org Product. Prices only when displayable; rating only when shown on the page. */
export function productJsonLd(p: JsonLdProductInput, url: string, now: Date, showRating: boolean): Record<string, unknown> {
  const offers = p.offers
    .filter((o) => o.active)
    .map((o) => {
      const price = displayPrice(o, now);
      const offer: Record<string, unknown> = {
        "@type": "Offer",
        url: o.url,
        seller: { "@type": "Organization", name: o.storeName },
        eligibleRegion: o.market,
      };
      if (price != null) {
        offer.price = decimal(price, o.currency);
        offer.priceCurrency = o.currency;
      }
      return offer;
    });
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    url,
    image: p.images,
  };
  if (p.description) ld.description = p.description;
  if (p.brand) ld.brand = { "@type": "Brand", name: p.brand };
  if (p.sku) ld.sku = p.sku;
  if (offers.length) ld.offers = offers;
  if (showRating && p.rating) {
    ld.aggregateRating = { "@type": "AggregateRating", ratingValue: p.rating.value, ...(p.rating.count ? { ratingCount: p.rating.count } : {}), bestRating: 5 };
  }
  return ld;
}

/** Serialize JSON-LD safely for a <script> tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
