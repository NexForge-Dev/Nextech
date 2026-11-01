"use client";
import { useState } from "react";
import { Menu, Search } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { CategoryIcon } from "@/components/category-icon";
import { SearchBox } from "./search-box";

type Labels = { menu: string; openSearch: string; categories: string; deals: string; favorites: string; account: string; allProducts: string; searchLabel: string };

export function MobileSearch({ labels }: { labels: Pick<Labels, "openSearch" | "searchLabel"> }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label={labels.openSearch} className="grid size-10 cursor-pointer place-items-center rounded-md hover:bg-soft md:hidden">
        <Search className="size-5" strokeWidth={1.75} aria-hidden />
      </SheetTrigger>
      <SheetContent side="top" className="gap-0 border-line p-4 pt-14 shadow-none">
        <SheetTitle className="sr-only">{labels.searchLabel}</SheetTitle>
        <SearchBox autoFocus onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function MobileMenu({ labels, categories, accountHref }: { labels: Labels; categories: { slug: string; name: string; icon: string }[]; accountHref: "/minha-conta" | "/entrar" }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const item = "flex items-center gap-3 rounded-md px-3 py-3 text-[15px] transition-colors duration-150 hover:bg-soft";
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label={labels.menu} className="grid size-10 cursor-pointer place-items-center rounded-md hover:bg-soft md:hidden">
        <Menu className="size-5" strokeWidth={1.75} aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="w-[86vw] max-w-sm gap-0 overflow-y-auto border-line p-0 shadow-none">
        <SheetTitle className="wordmark border-b border-line px-5 py-5 text-lg">NEXTECH</SheetTitle>
        <nav className="flex flex-col p-3">
          <Link href="/produtos" onClick={close} className={`${item} font-medium`}>{labels.allProducts}</Link>
          <Link href="/ofertas" onClick={close} className={item}>{labels.deals}</Link>
          <Link href="/favoritos" onClick={close} className={item}>{labels.favorites}</Link>
          <Link href={accountHref} onClick={close} className={item}>{labels.account}</Link>
          <p className="mt-4 px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-mute">{labels.categories}</p>
          {categories.map((c) => (
            <Link key={c.slug} href={{ pathname: "/categoria/[slug]", params: { slug: c.slug } }} onClick={close} className={item}>
              <CategoryIcon name={c.icon} className="size-4 text-ink" />
              {c.name}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
