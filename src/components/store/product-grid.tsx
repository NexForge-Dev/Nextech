import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import type { ProductCardData } from "@/lib/data/catalog";
import { ProductCard } from "./product-card";
import { ProductRail } from "./product-rail";

type GridProps = { products: ProductCardData[]; locale: Locale; signedIn: boolean; favorites?: Set<string>; priorityCount?: number; notes?: Map<string, string>; ctas?: Map<string, { href: string; label: string }>; columns?: "wide" | "narrow" };

export function ProductGrid({ products, locale, signedIn, favorites, priorityCount = 0, notes, ctas, columns = "wide" }: GridProps) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 ${columns === "wide" ? "lg:grid-cols-4" : "xl:grid-cols-4"}`}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} locale={locale} signedIn={signedIn} favorite={favorites?.has(p.id)} priority={i < priorityCount} note={notes?.get(p.id)} cta={ctas?.get(p.id)} />
      ))}
    </div>
  );
}

/** Same cards as the grid, on a swipeable shelf. */
export async function ProductShelf({ products, locale, signedIn, favorites, priorityCount = 0 }: Pick<GridProps, "products" | "locale" | "signedIn" | "favorites" | "priorityCount">) {
  const tc = await getTranslations("common");
  return (
    <ProductRail labels={{ previous: tc("previous"), next: tc("next") }}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} locale={locale} signedIn={signedIn} favorite={favorites?.has(p.id)} priority={i < priorityCount} />
      ))}
    </ProductRail>
  );
}

export function Section({ title, subtitle, action, tone = "white", children }: { title: string; subtitle?: string; action?: ReactNode; tone?: "white" | "soft"; children: ReactNode }) {
  return (
    <section className={tone === "soft" ? "bg-soft" : ""}>
      <div className="shell py-10 md:py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="t-section">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}
