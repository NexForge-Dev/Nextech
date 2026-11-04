"use client";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "@/i18n/navigation";
import { CategoryIcon } from "@/components/category-icon";

export function CategoriesMenu({ label, allLabel, categories }: { label: string; allLabel: string; categories: { slug: string; name: string; icon: string }[] }) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-sm font-semibold text-black underline-offset-4 hover:underline">
        {label}
        <ChevronDown className="size-3.5" strokeWidth={1.75} aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[520px] max-w-[calc(100vw-2rem)] rounded-lg border border-line p-3 shadow-[var(--shadow-pop)] ring-0">
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
