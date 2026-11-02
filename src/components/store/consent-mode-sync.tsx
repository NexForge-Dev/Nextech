"use client";
import { useEffect } from "react";
import { googleConsentState } from "@/lib/domain/consent";

type Gtag = (...args: unknown[]) => void;

/**
 * Keeps Google Consent Mode v2 in step with the cookie banner after the first load: when the visitor
 * changes their choices, gtag (if already loaded on this page) gets a `consent update` right away.
 */
export function ConsentModeSync({ analytics, marketing }: { analytics: boolean; marketing: boolean }) {
  useEffect(() => {
    const gtag = (window as Window & { gtag?: Gtag }).gtag;
    if (!gtag) return;
    gtag("consent", "update", googleConsentState({ analytics, marketing }));
    gtag("set", "ads_data_redaction", !marketing);
  }, [analytics, marketing]);
  return null;
}
