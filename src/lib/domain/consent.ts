export type Consent = { v: 1; analytics: boolean; marketing: boolean; decidedAt: string };

export const CONSENT_COOKIE = "nx_consent";
export const SESSION_COOKIE = "nx_sid";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // 6 months, then ask again

export function parseConsent(cookie: string | undefined): Consent | null {
  if (!cookie) return null;
  try {
    const v = JSON.parse(decodeURIComponent(cookie));
    if (v?.v !== 1 || typeof v.analytics !== "boolean" || typeof v.marketing !== "boolean" || typeof v.decidedAt !== "string") return null;
    return { v: 1, analytics: v.analytics, marketing: v.marketing, decidedAt: v.decidedAt };
  } catch {
    return null;
  }
}

export function serializeConsent(c: Consent): string {
  return encodeURIComponent(JSON.stringify(c));
}

/** Google Consent Mode v2 signals. */
export type GoogleConsentState = {
  ad_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
  ad_personalization: "granted" | "denied";
  analytics_storage: "granted" | "denied";
};

export const GOOGLE_CONSENT_DENIED: GoogleConsentState = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" };

/** Map the banner categories to Consent Mode v2: analytics to analytics_storage; marketing to the three ad signals. */
export function googleConsentState(c: { analytics: boolean; marketing: boolean }): GoogleConsentState {
  const g = (on: boolean): "granted" | "denied" => (on ? "granted" : "denied");
  return { ad_storage: g(c.marketing), ad_user_data: g(c.marketing), ad_personalization: g(c.marketing), analytics_storage: g(c.analytics) };
}
