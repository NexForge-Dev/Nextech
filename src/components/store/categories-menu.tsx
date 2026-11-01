"use client";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "@/i18n/navigation";
import { CategoryIcon } from "@/components/category-icon";

export function CategoriesMenu({ label, allLabel, categories }: { label: string; allLabel: string; categories: { slug: string; name: string; icon: string }[] }) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex cursor-pointer items-center gap-1 text-sm text-black transition-colors duration-150 hover:text-ink">
        {label}
        <ChevronDown className="size-3.5" strokeWidth={1.75} aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[520px] max-w-[calc(100vw-2rem)] rounded-md border border-line p-3 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-0">
        <div className="grid grid-cols-2 gap-1">
          {categories.map((c) => (
            <Link key={c.slug} href={{ pathname: "/categoria/[slug]", params: { slug: c.slug } }} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-soft">
              <CategoryIcon name={c.icon} className="size-4 text-ink" />
              {c.name}
            </Link>
          ))}
        </div>
        <div className="mt-2 border-t border-line pt-2">
          <Link href="/produtos" className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-soft">{allLabel}</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
