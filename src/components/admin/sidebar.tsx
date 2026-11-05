"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck, ChartLine, ChartPie, FileSpreadsheet, GalleryHorizontal, LayoutDashboard, Link2, Megaphone, Menu, Network, Package, ShoppingCart,
  PanelLeftClose, PanelLeftOpen, Settings, Shapes, ShieldCheck, Store, Tag, Users, type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV_GROUP_LABEL, type NavGroup, type NavItem } from "./nav";

const ICONS: Record<string, LucideIcon> = { BadgeCheck, ChartLine, ChartPie, FileSpreadsheet, GalleryHorizontal, LayoutDashboard, Link2, Megaphone, Network, Package, Settings, ShoppingCart, Shapes, ShieldCheck, Store, Tag, Users };

function NavLinks({ items, collapsed, onNavigate }: { items: NavItem[]; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-4" aria-label="Menu do painel">
      {(Object.keys(NAV_GROUP_LABEL) as NavGroup[]).map((group) => {
        const list = items.filter((i) => i.group === group);
        if (!list.length) return null;
        return (
          <div key={group} className="flex flex-col gap-0.5">
            {NAV_GROUP_LABEL[group] && !collapsed && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">{NAV_GROUP_LABEL[group]}</p>}
            {list.map((i) => {
              const Icon = ICONS[i.icon] ?? Package;
              const active = i.href === "/admin" ? pathname === "/admin" : pathname === i.href || pathname.startsWith(`${i.href}/`);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={onNavigate}
                  title={collapsed ? i.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${active ? "bg-white font-medium text-black" : "text-white/75 hover:bg-white/10 hover:text-white"} ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                  {!collapsed && <span className="truncate">{i.label}</span>}
                  {collapsed && <span className="sr-only">{i.label}</span>}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar({ items, initialCollapsed }: { items: NavItem[]; initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `nx_admin_sidebar=${next ? "1" : "0"}; path=/admin; max-age=31536000; samesite=lax`;
  }
  return (
    <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-black text-white transition-[width] duration-200 lg:flex ${collapsed ? "w-[68px]" : "w-60"}`}>
      <div className={`flex h-16 items-center border-b border-white/15 ${collapsed ? "justify-center" : "justify-between px-5"}`}>
        {!collapsed && (
          <Link href="/admin" className="flex items-baseline gap-2">
            <span className="wordmark text-lg">NEXTECH</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-white/60">Admin</span>
          </Link>
        )}
        <button type="button" onClick={toggle} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} className="grid size-8 cursor-pointer place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white">
          {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavLinks items={items} collapsed={collapsed} />
      </div>
    </aside>
  );
}

export function MobileSidebar({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label="Abrir menu" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-md hover:bg-soft lg:hidden">
        <Menu className="size-5" strokeWidth={1.75} aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" closeLabel="Fechar menu" className="w-72 gap-0 border-0 bg-black p-0 text-white shadow-none [&_[data-slot=sheet-close]]:text-white">
        <SheetTitle className="border-b border-white/15 px-5 py-5 text-white">
          <span className="wordmark text-lg">NEXTECH</span> <span className="text-[10px] font-medium uppercase tracking-widest text-white/60">Admin</span>
        </SheetTitle>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <NavLinks items={items} collapsed={false} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
