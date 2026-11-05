"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";
import { formatCountdown } from "@/lib/domain/own-pricing";

// one clock for the whole page, however many cards are counting
const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  ticker ??= setInterval(() => listeners.forEach((l) => l()), 1000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}

const secondsNow = () => Math.floor(Date.now() / 1000);
let lastRefresh = 0;
const REFRESH_EVERY_MS = 3000;
const REFRESH_TRIES = 5;

/** Counts down to the end of a promotion; at zero the page reloads its data and shows the regular price. */
export function PromoCountdown({ endsAt, label, compact = false, className = "" }: { endsAt: string; label: string; compact?: boolean; className?: string }) {
  const router = useRouter();
  const now = useSyncExternalStore(subscribe, secondsNow, () => null);
  const left = now == null ? null : Math.ceil(Date.parse(endsAt) / 1000) - now;
  const over = left != null && left <= 0;

  useEffect(() => {
    if (!over) return;
    // this browser's clock can be ahead of the server's, so keep asking until the regular price comes
    // back; that unmounts this component. Cards ending together share one refresh.
    let tries = 0;
    const refresh = () => {
      if (++tries >= REFRESH_TRIES) clearInterval(retry);
      if (Date.now() - lastRefresh < REFRESH_EVERY_MS - 500) return;
      lastRefresh = Date.now();
      router.refresh();
    };
    const retry = setInterval(refresh, REFRESH_EVERY_MS);
    refresh();
    return () => clearInterval(retry);
  }, [over, router]);

  if (over) return null;
  return (
    <p data-testid="promo-countdown" className={`flex items-center gap-1.5 rounded-sm bg-black text-white ${compact ? "w-fit px-1.5 py-0.5 text-[11px]" : "px-3 py-2 text-sm"} ${className}`}>
      <Timer className={compact ? "size-3" : "size-4"} strokeWidth={1.75} aria-hidden />
      <span className={compact ? "sr-only" : undefined}>{label}</span>
      <span className="tabular font-semibold" role="timer">{left == null ? "--:--:--" : formatCountdown(left)}</span>
    </p>
  );
}
