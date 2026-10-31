import type { ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import type { ProductCardData } from "@/lib/data/catalog";
import { ProductCard } from "./product-card";

export function ProductGrid({ products, locale, signedIn, favorites, priorityCount = 0, notes, ctas }: { products: ProductCardData[]; locale: Locale; signedIn: boolean; favorites?: Set<string>; priorityCount?: number; notes?: Map<string, string>; ctas?: Map<string, { href: string; label: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} locale={locale} signedIn={signedIn} favorite={favorites?.has(p.id)} priority={i < priorityCount} note={notes?.get(p.id)} cta={ctas?.get(p.id)} />
      ))}
    </div>
  );
}

export function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6 md:py-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
