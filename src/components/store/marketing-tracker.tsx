"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Fbq = (...args: unknown[]) => void;
type Gtag = (...args: unknown[]) => void;
type MarketingWindow = Window & { fbq?: Fbq; gtag?: Gtag; __nxAdsSendTo?: string | null };

export type AdEvent = "AddToCart" | "InitiateCheckout" | "Purchase";
export type AdEventData = { valueMinor: number; currency: "BRL"; contentIds: string[]; orderNumber?: number };

/**
 * Own-store funnel events for Meta and Google Ads. Only does anything when the consented tags are
 * loaded (window.fbq / window.gtag exist). A purchase is sent once per order (sessionStorage guard)
 * with eventID "order-<n>" so Meta can de-duplicate it.
 */
export function trackAdEvent(name: AdEvent, data: AdEventData) {
  if (typeof window === "undefined") return;
  const w = window as MarketingWindow;
  if (name === "Purchase") {
    if (data.orderNumber == null) return;
    const key = `nx_purchase_${data.orderNumber}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage unavailable: send anyway */
    }
  }
  const value = data.valueMinor / 100;
  const payload = { value, currency: data.currency, content_ids: data.contentIds, content_type: "product" };
  if (w.fbq) {
    if (name === "Purchase") w.fbq("track", name, payload, { eventID: `order-${data.orderNumber}` });
    else w.fbq("track", name, payload);
  }
  if (name === "Purchase" && w.gtag && w.__nxAdsSendTo) {
    w.gtag("event", "conversion", { send_to: w.__nxAdsSendTo, value, currency: data.currency, transaction_id: String(data.orderNumber) });
  }
}

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
    (window as MarketingWindow).__nxAdsSendTo = googleAdsSendTo;
  }, [googleAdsSendTo]);

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
