"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Search, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { adminSearch, type AdminSearchHit } from "@/actions/admin/search";
import { markNotificationsRead } from "@/actions/admin/notifications";
import { adminSignOut } from "@/actions/admin/session";
import { ADMIN_NAV, type NavItem } from "./nav";
import { MobileSidebar } from "./sidebar";

type Notification = { key: string; title: string; href: string; at: string; read: boolean };

function usePageTitle() {
  const pathname = usePathname();
  const match = [...ADMIN_NAV].sort((a, b) => b.href.length - a.href.length).find((i) => (i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href)));
  return match?.label ?? "Painel";
}

function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<AdminSearchHit[]>([]);
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => start(async () => setHits(v.trim().length >= 2 ? await adminSearch(v) : [])), 200);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-10 w-full max-w-md cursor-pointer items-center gap-2 rounded-md border border-line bg-soft px-3 text-left text-sm text-mute hover:border-mute">
        <Search className="size-4" strokeWidth={1.75} aria-hidden />
        <span className="flex-1 truncate">Pesquisar produtos, categorias, lojas…</span>
        <kbd className="hidden rounded border border-line bg-white px-1.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-24 max-w-xl translate-y-0 gap-0 rounded-md border border-line p-0 shadow-none ring-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Pesquisa administrativa</DialogTitle>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search className="size-4 text-mute" aria-hidden />
            <input autoFocus value={q} onChange={(e) => onChange(e.target.value)} placeholder="Nome, slug ou SKU" className="h-12 flex-1 bg-transparent text-sm outline-none" aria-label="Pesquisar" />
          </div>
          <ul className="max-h-[60vh] overflow-y-auto p-2">
            {q.trim().length >= 2 && hits.length === 0 && <li className="px-3 py-6 text-center text-sm text-mute">Nenhum resultado</li>}
            {hits.map((h) => (
              <li key={`${h.kind}-${h.href}`}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(h.href);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-md px-3 py-2.5 text-left text-sm hover:bg-soft"
                >
                  <span className="truncate">{h.label}</span>
                  <span className="shrink-0 text-xs text-mute">
                    {h.kind} · <span className="font-mono">{h.sub}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Notifications({ items, unread }: { items: Notification[]; unread: number }) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <Popover>
      <PopoverTrigger aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`} className="relative grid size-10 cursor-pointer place-items-center rounded-md hover:bg-soft">
        <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden />
        {unread > 0 && <span className="tabular absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-black px-1 text-[10px] font-semibold text-white">{unread}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] gap-0 rounded-md border border-line p-0 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          {unread > 0 && (
            <button type="button" onClick={() => start(async () => { await markNotificationsRead(items.filter((i) => !i.read).map((i) => i.key)); router.refresh(); })} className="cursor-pointer text-xs font-medium hover:underline">
              Marcar todas como lidas
            </button>
          )}
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-mute">Nenhuma notificação</li>}
          {items.map((n) => (
            <li key={n.key} className="border-b border-line last:border-0">
              <Link
                href={n.href}
                onClick={() => !n.read && start(async () => { await markNotificationsRead([n.key]); })}
                className="flex gap-3 px-4 py-3 text-sm hover:bg-soft"
              >
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-black"}`} aria-hidden />
                <span className={n.read ? "text-mute" : "font-medium"}>{n.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function AdminHeader({ nav, email, roleLabel, notifications, unread }: { nav: NavItem[]; email: string; roleLabel: string; notifications: Notification[]; unread: number }) {
  const title = usePageTitle();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur md:px-6">
      <MobileSidebar items={nav} />
      <p className="hidden min-w-0 shrink-0 truncate text-base font-semibold md:block md:w-48">{title}</p>
      <div className="flex flex-1 justify-center">
        <GlobalSearch />
      </div>
      <Notifications items={notifications} unread={unread} />
      <Popover>
        <PopoverTrigger aria-label="Perfil" className="grid size-10 cursor-pointer place-items-center rounded-full border border-line hover:bg-soft">
          <UserRound className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 rounded-md border border-line p-0 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-0">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium">{email}</p>
            <p className="text-xs text-mute">{roleLabel}</p>
          </div>
          <form action={adminSignOut} className="p-1">
            <button type="submit" className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-soft">
              <LogOut className="size-4" aria-hidden /> Sair
            </button>
          </form>
        </PopoverContent>
      </Popover>
    </header>
  );
}
