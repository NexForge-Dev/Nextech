"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, LayoutGrid, Menu, Tag, User } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { CategoryIcon } from "@/components/category-icon";

type Labels = { menu: string; categories: string; deals: string; favorites: string; account: string; allProducts: string };

export function MobileMenu({ labels, categories, accountHref, storeName }: { labels: Labels; categories: { slug: string; name: string; icon: string }[]; accountHref: "/minha-conta" | "/entrar"; storeName: string }) {
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const item = "flex items-center gap-3 rounded-md px-3 py-3 text-[15px] transition-colors duration-150 hover:bg-soft";
  const icon = "size-[18px] shrink-0";
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label={labels.menu} className="-ml-2 grid size-10 cursor-pointer place-items-center rounded-md hover:bg-soft md:hidden">
        <Menu className="size-5" strokeWidth={1.75} aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" closeLabel={tc("close")} className="w-[86vw] max-w-sm gap-0 overflow-y-auto border-line p-0 shadow-none">
        <SheetTitle className="wordmark border-b border-line px-5 py-5 text-lg">{storeName.toUpperCase()}</SheetTitle>
        <nav className="flex flex-col p-3">
          <Link href="/produtos" onClick={close} className={`${item} font-medium`}><LayoutGrid className={icon} strokeWidth={1.75} aria-hidden />{labels.allProducts}</Link>
          <Link href="/ofertas" onClick={close} className={`${item} font-medium`}><Tag className={icon} strokeWidth={1.75} aria-hidden />{labels.deals}</Link>
          <Link href="/favoritos" onClick={close} className={item}><Heart className={icon} strokeWidth={1.75} aria-hidden />{labels.favorites}</Link>
          <Link href={accountHref} onClick={close} className={item}><User className={icon} strokeWidth={1.75} aria-hidden />{labels.account}</Link>
          <p className="t-eyebrow mt-4 border-t border-line px-3 pb-2 pt-5">{labels.categories}</p>
          {categories.map((c) => (
            <Link key={c.slug} href={{ pathname: "/categoria/[slug]", params: { slug: c.slug } }} onClick={close} className={item}>
              <CategoryIcon name={c.icon} className={`${icon} text-ink`} />
              {c.name}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
