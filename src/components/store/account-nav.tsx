"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const ITEMS = [
  { href: "/minha-conta", key: "info" },
  { href: "/minha-conta/favoritos", key: "favorites" },
  { href: "/minha-conta/historico", key: "history" },
  { href: "/minha-conta/preferencias", key: "preferences" },
  { href: "/minha-conta/privacidade", key: "privacy" },
] as const;

export function AccountNav() {
  const t = useTranslations("account");
  const pathname = usePathname();
  return (
    <nav aria-label={t("title")} className="-mx-1 flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map((i) => {
        const active = pathname === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${active ? "bg-black font-medium text-white" : "hover:bg-soft"}`}
          >
            {t(i.key)}
          </Link>
        );
      })}
    </nav>
  );
}
