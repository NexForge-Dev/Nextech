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
