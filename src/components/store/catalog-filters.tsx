"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type FilterValues = { q?: string; category?: string; brand?: string; store?: string; min?: string; max?: string; rating?: string; discount?: boolean; sort?: string };
type Option = { slug: string; name: string };

function buildQuery(v: FilterValues): string {
  const sp = new URLSearchParams();
  if (v.q) sp.set("q", v.q);
  if (v.category) sp.set("category", v.category);
  if (v.brand) sp.set("brand", v.brand);
  if (v.store) sp.set("store", v.store);
  if (v.min) sp.set("min", v.min);
  if (v.max) sp.set("max", v.max);
  if (v.rating) sp.set("rating", v.rating);
  if (v.discount) sp.set("discount", "1");
  if (v.sort) sp.set("sort", v.sort);
  return sp.toString();
}

function FilterForm({ values, categories, brands, stores, hideCategory, onDone }: { values: FilterValues; categories: Option[]; brands: Option[]; stores: Option[]; hideCategory?: boolean; onDone?: () => void }) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const [v, setV] = useState<FilterValues>(values);
  const field = "h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-black";
  const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-mute";

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const qs = buildQuery({ ...v, q: values.q, sort: values.sort });
    router.push(qs ? `${pathname}?${qs}` : pathname);
    onDone?.();
  }

  return (
    <form onSubmit={apply} className="space-y-6">
      {!hideCategory && (
        <div>
          <label className={label} htmlFor="f-category">{t("category")}</label>
          <select id="f-category" className={field} value={v.category ?? ""} onChange={(e) => setV({ ...v, category: e.target.value || undefined })}>
            <option value="">{t("all")}</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
      )}
      {brands.length > 0 && (
        <div>
          <label className={label} htmlFor="f-brand">{t("brand")}</label>
          <select id="f-brand" className={field} value={v.brand ?? ""} onChange={(e) => setV({ ...v, brand: e.target.value || undefined })}>
            <option value="">{t("all")}</option>
            {brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
          </select>
        </div>
      )}
      {stores.length > 0 && (
        <div>
          <label className={label} htmlFor="f-store">{t("store")}</label>
          <select id="f-store" className={field} value={v.store ?? ""} onChange={(e) => setV({ ...v, store: e.target.value || undefined })}>
            <option value="">{t("all")}</option>
            {stores.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </div>
      )}
      <fieldset>
        <legend className={label}>{t("price")}</legend>
        <div className="flex gap-2">
          <input aria-label={t("minPrice")} placeholder={t("minPrice")} inputMode="decimal" className={field} value={v.min ?? ""} onChange={(e) => setV({ ...v, min: e.target.value.replace(/[^\d.,]/g, "") || undefined })} />
          <input aria-label={t("maxPrice")} placeholder={t("maxPrice")} inputMode="decimal" className={field} value={v.max ?? ""} onChange={(e) => setV({ ...v, max: e.target.value.replace(/[^\d.,]/g, "") || undefined })} />
        </div>
      </fieldset>
      <div>
        <label className={label} htmlFor="f-rating">{t("rating")}</label>
        <select id="f-rating" className={field} value={v.rating ?? ""} onChange={(e) => setV({ ...v, rating: e.target.value || undefined })}>
          <option value="">{t("anyRating")}</option>
          {[4, 3, 2, 1].map((r) => <option key={r} value={String(r)}>{t("ratingValue", { value: r })}</option>)}
        </select>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-black" checked={!!v.discount} onChange={(e) => setV({ ...v, discount: e.target.checked || undefined })} />
        {t("provenDiscount")}
      </label>
      <div className="flex gap-2">
        <button type="submit" className="h-10 flex-1 cursor-pointer rounded-md bg-black px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-ink">{t("apply")}</button>
        <button
          type="button"
          onClick={() => {
            router.push(values.q ? `${pathname}?q=${encodeURIComponent(values.q)}` : pathname);
            onDone?.();
          }}
          className="h-10 cursor-pointer rounded-md border border-line px-4 text-sm font-medium transition-colors duration-150 hover:bg-soft"
        >
          {t("clearFilters")}
        </button>
      </div>
    </form>
  );
}

export function CatalogFilters(props: { values: FilterValues; categories: Option[]; brands: Option[]; stores: Option[]; hideCategory?: boolean }) {
  const t = useTranslations("catalog");
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="hidden lg:block">
        <FilterForm {...props} />
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-line px-4 text-sm font-medium hover:bg-soft lg:hidden">
          <SlidersHorizontal className="size-4" strokeWidth={1.75} aria-hidden />
          {t("filter")}
        </SheetTrigger>
        <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto border-line p-5 shadow-none">
          <SheetTitle className="mb-2 text-lg font-semibold">{t("filters")}</SheetTitle>
          <FilterForm {...props} onDone={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export function SortSelect({ value, hasQuery }: { value: string; hasQuery: boolean }) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const options = [
    ...(hasQuery ? [["relevance", t("sortRelevance")]] : []),
    ["price_asc", t("sortPriceAsc")],
    ["price_desc", t("sortPriceDesc")],
    ["popular", t("sortPopular")],
    ["recent", t("sortRecent")],
    ["discount", t("sortDiscount")],
  ] as [string, string][];
  return (
    <label className="inline-flex items-center gap-2 text-sm text-mute">
      <span className="hidden sm:inline">{t("sort")}</span>
      <select
        aria-label={t("sort")}
        value={value}
        onChange={(e) => {
          const sp = new URLSearchParams(window.location.search);
          sp.set("sort", e.target.value);
          sp.delete("page");
          router.push(`${pathname}?${sp.toString()}`);
        }}
        className="h-10 cursor-pointer rounded-md border border-line bg-white px-3 text-sm text-black outline-none focus:border-black"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
