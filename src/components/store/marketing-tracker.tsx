"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Fbq = (...args: unknown[]) => void;
type Gtag = (...args: unknown[]) => void;
type MarketingWindow = Window & { fbq?: Fbq; gtag?: Gtag };

/** Outbound clicks to partner stores go through /go/[productId]. */
export function isBuyLink(href: string | null, origin: string): boolean {
  if (!href) return false;
  try {
    const u = new URL(href, origin);
    return u.origin === origin && u.pathname.startsWith("/go/");
  } catch {
    return false;
  }
}

/**
 * Sends ad-platform events once marketing consent is given:
 * - Meta Pixel PageView on client-side navigations (the first one is sent by the init snippet);
 * - "Lead" (Meta) and the Google Ads conversion when the visitor clicks a buy button.
 */
export function MarketingTracker({ pixel, googleAdsSendTo }: { pixel: boolean; googleAdsSendTo: string | null }) {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (pixel) (window as MarketingWindow).fbq?.("track", "PageView");
  }, [pathname, pixel]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !isBuyLink(a.getAttribute("href"), window.location.origin)) return;
      const w = window as MarketingWindow;
      if (pixel) w.fbq?.("track", "Lead");
      if (googleAdsSendTo) w.gtag?.("event", "conversion", { send_to: googleAdsSendTo, transport_type: "beacon" });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [pixel, googleAdsSendTo]);

  return null;
}
