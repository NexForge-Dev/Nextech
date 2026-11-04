"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  ["today", "Hoje"],
  ["7d", "Últimos 7 dias"],
  ["30d", "Últimos 30 dias"],
  ["90d", "Últimos 90 dias"],
  ["custom", "Personalizado"],
] as const;

export function PeriodFilter({ current, from, to, children }: { current: string; from: string; to: string; children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [custom, setCustom] = useState(current === "custom");
  const [range, setRange] = useState({ from, to });
  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${pathname}?${next.toString()}`);
  };
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
        {OPTIONS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === "custom" ? custom : current === k && !custom}
            onClick={() => (k === "custom" ? setCustom(true) : (setCustom(false), go({ p: k, from: null, to: null })))}
            className={`h-9 cursor-pointer rounded-md border px-3 text-sm transition-colors duration-150 ${(k === "custom" ? custom : current === k && !custom) ? "border-black bg-black text-white" : "border-line bg-white hover:bg-soft"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {custom && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ p: "custom", from: range.from, to: range.to });
          }}
        >
          <input type="date" aria-label="De" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="field h-9 w-auto px-2" />
          <span className="text-sm text-mute">até</span>
          <input type="date" aria-label="Até" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="field h-9 w-auto px-2" />
          <button type="submit" className="btn btn-primary h-9">Aplicar</button>
        </form>
      )}
      {children}
    </div>
  );
}
