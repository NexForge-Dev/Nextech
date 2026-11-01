import "server-only";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { CONSENT_COOKIE, SESSION_COOKIE, parseConsent } from "@/lib/domain/consent";
import type { Locale } from "@/i18n/routing";
import { isBot } from "./bots";

export type TrackEvent =
  | { type: "product_view"; productId: string; locale: Locale; market: string }
  | { type: "category_view"; categoryId: string; locale: Locale; market: string }
  | { type: "home_view"; locale: Locale; market: string }
  | { type: "search"; locale: Locale; market: string; query: string; results: number; userId?: string | null };

/** Same-site path only, without query string (never store full external URLs). */
export function referrerPath(referrer: string | null, host: string | null): string | null {
  if (!referrer) return null;
  try {
    const u = new URL(referrer);
    if (host && u.host !== host) return `external:${u.hostname}`.slice(0, 300);
    return u.pathname.slice(0, 300);
  } catch {
    return null;
  }
}

/**
 * Record an anonymous event after the response is sent. Identifier-free unless the visitor gave
 * analytics consent (then: anonymous session id + referrer path). Never throws.
 */
export async function recordEvent(e: TrackEvent): Promise<void> {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const consent = parseConsent(jar.get(CONSENT_COOKIE)?.value);
  const ua = h.get("user-agent");
  const withConsent = consent?.analytics === true;
  const sessionId = withConsent ? (jar.get(SESSION_COOKIE)?.value ?? null) : null;
  const ref = withConsent ? referrerPath(h.get("referer"), h.get("host")) : null;
  const bot = isBot(ua);
  after(async () => {
    try {
      const sb = createServiceSupabase();
      if (e.type === "search") {
        await sb.from("searches").insert({ query: e.query.slice(0, 100), locale: e.locale, results: e.results, user_id: withConsent ? (e.userId ?? null) : null });
        return;
      }
      await sb.from("analytics_events").insert({
        type: e.type,
        product_id: e.type === "product_view" ? e.productId : null,
        category_id: e.type === "category_view" ? e.categoryId : null,
        locale: e.locale,
        market: e.market,
        session_id: sessionId,
        referrer_path: ref,
        is_bot: bot,
      });
    } catch (err) {
      console.error(JSON.stringify({ level: "error", event: "track.failed", type: e.type, message: err instanceof Error ? err.message : String(err) }));
    }
  });
}
