import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/domain/money";
import type { PriceSummary } from "@/lib/domain/pricing";

/**
 * Honest price block: never shows 0, NaN, a converted price or an unproven discount.
 * `hideDiscount`: the caller shows the percentage itself (product cards put it over the image).
 */
export async function PriceView({ price, locale, size = "md", hideDiscount = false }: { price: PriceSummary; locale: Locale; size?: "md" | "lg"; hideDiscount?: boolean }) {
  const t = await getTranslations("product");
  if (price.kind === "link_only") return <p className="text-sm font-medium text-black">{t("seePriceOnStore")}</p>;
  if (price.kind === "unavailable") return <p className="text-sm text-mute">{t("unavailableInCountry")}</p>;
  const main = size === "lg" ? "text-3xl md:text-4xl" : "text-lg md:text-xl";
  const proven = price.previousMinor != null && price.discount != null;
  return (
    <div>
      {/* keeps prices aligned across a row of cards when only some have a discount */}
      {proven ? (
        <p className="flex items-center gap-2 text-xs md:text-sm">
          <span className="tabular text-mute line-through" aria-label={t("previousPrice")}>{formatMoney(price.previousMinor!, price.currency, locale)}</span>
          {!hideDiscount && <span className="rounded-sm bg-black px-1.5 py-0.5 text-[11px] font-semibold text-white">{t("discount", { percent: price.discount! })}</span>}
        </p>
      ) : (
        hideDiscount && <p className="h-4 md:h-5" aria-hidden />
      )}
      <p data-testid="price-main" className={`tabular font-semibold tracking-tight text-black ${main}`}>
        {price.multiple && <span className="mr-1 text-xs font-normal text-mute">{t("from")}</span>}
        {formatMoney(price.fromMinor, price.currency, locale)}
      </p>
    </div>
  );
}
