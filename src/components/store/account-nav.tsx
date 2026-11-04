"use client";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Heart, History, Package, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

const ITEMS = [
  { href: "/minha-conta", key: "info", icon: UserRound },
  { href: "/minha-conta/pedidos", key: "orders", icon: Package },
  { href: "/minha-conta/favoritos", key: "favorites", icon: Heart },
  { href: "/minha-conta/historico", key: "history", icon: History },
  { href: "/minha-conta/preferencias", key: "preferences", icon: Settings2 },
  { href: "/minha-conta/privacidade", key: "privacy", icon: ShieldCheck },
] as const;

export function AccountNav() {
  const t = useTranslations("account");
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  // on mobile the tabs scroll sideways: keep the current one visible
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>("[aria-current=page]");
    if (nav && active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = active.offsetLeft - nav.offsetLeft - 16;
  }, [pathname]);
  return (
    <nav ref={navRef} aria-label={t("title")} className="rail -mx-4 gap-1 px-4 lg:mx-0 lg:flex-col lg:rounded-lg lg:border lg:border-line lg:bg-white lg:p-2">
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = pathname === href || (href === "/minha-conta/pedidos" && pathname.startsWith("/minha-conta/pedidos"));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md border px-3 py-2.5 text-sm transition-colors duration-150 lg:border-0 ${active ? "border-black bg-black font-medium text-white" : "border-line bg-white hover:bg-soft"}`}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
