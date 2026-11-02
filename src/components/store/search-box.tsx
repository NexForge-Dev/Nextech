"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

type Item = { kind: "product" | "brand" | "category"; slug: string; label: string; href: string };

export function SearchBox({ autoFocus = false, onNavigate, initialQuery = "" }: { autoFocus?: boolean; onNavigate?: () => void; initialQuery?: string }) {
  const t = useTranslations("header");
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const timer = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}&locale=${locale}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { items: Item[] };
        setItems(json.items);
        setActive(-1);
      } catch {
        /* aborted or offline — suggestions are optional */
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [q, locale]);

  function submit(term: string) {
    const v = term.trim().slice(0, 100);
    setOpen(false);
    onNavigate?.();
    router.push(v ? { pathname: "/produtos", query: { q: v } } : "/produtos");
  }

  function go(item: Item) {
    setOpen(false);
    onNavigate?.();
    window.location.assign(item.href);
  }

  const groups: { kind: Item["kind"]; label: string }[] = [
    { kind: "product", label: t("suggestionsProducts") },
    { kind: "brand", label: t("suggestionsBrands") },
    { kind: "category", label: t("suggestionsCategories") },
  ];

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0 && items[active]) go(items[active]);
        else submit(q);
      }}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">{t("searchLabel")}</label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" strokeWidth={1.75} aria-hidden />
      <input
        id={`${listId}-input`}
        type="search"
        autoFocus={autoFocus}
        autoComplete="off"
        maxLength={100}
        value={q}
        placeholder={t("searchPlaceholder")}
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 && items[active] ? `${listId}-opt-${active}` : undefined}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, -1));
          } else if (e.key === "Escape") setOpen(false);
        }}
        className="h-10 w-full rounded-md border border-line bg-soft pl-9 pr-3 text-sm text-black outline-none transition-colors duration-150 placeholder:text-mute focus:border-black focus:bg-white"
      />
      {open && q.trim().length >= 2 && (
        <div id={listId} role="listbox" className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-md border border-line bg-white py-2 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          {items.length === 0 || q.trim().length < 2 ? (
            <p className="px-4 py-2 text-sm text-mute">{t("noSuggestions")}</p>
          ) : (
            groups.map((g) => {
              const list = items.filter((i) => i.kind === g.kind);
              if (!list.length) return null;
              return (
                <div key={g.kind} role="group" aria-labelledby={`${listId}-${g.kind}`} className="py-1">
                  <p id={`${listId}-${g.kind}`} className="px-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-mute">{g.label}</p>
                  {list.map((item) => {
                    const idx = items.indexOf(item);
                    return (
                      <button
                        type="button"
                        role="option"
                        id={`${listId}-opt-${idx}`}
                        aria-selected={idx === active}
                        key={`${item.kind}-${item.slug}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(item)}
                        className={`block w-full truncate px-4 py-2 text-left text-sm transition-colors duration-150 hover:bg-soft ${idx === active ? "bg-soft" : ""}`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
          <button
            type="submit"
            onMouseDown={(e) => e.preventDefault()}
            className="mt-1 block w-full border-t border-line px-4 pt-3 pb-1 text-left text-sm font-medium hover:underline"
          >
            {t("searchFor", { q: q.trim() })}
          </button>
        </div>
      )}
    </form>
  );
}
