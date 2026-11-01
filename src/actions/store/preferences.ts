"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { MARKET_COOKIE } from "@/lib/domain/markets";
import { CONSENT_COOKIE, CONSENT_MAX_AGE, SESSION_COOKIE, serializeConsent } from "@/lib/domain/consent";
import { getAvailableMarkets } from "@/lib/data/taxonomy";

const secure = process.env.NODE_ENV === "production";

export async function setMarket(market: string): Promise<{ ok: boolean }> {
  const code = z.string().regex(/^[A-Z]{2}$/).safeParse(market.toUpperCase());
  if (!code.success) return { ok: false };
  const available = (await getAvailableMarkets()).map((m) => m.code);
  if (!available.includes(code.data)) return { ok: false };
  (await cookies()).set(MARKET_COOKIE, code.data, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure, httpOnly: false });
  return { ok: true };
}

export async function saveConsent(input: { analytics: boolean; marketing: boolean }): Promise<{ ok: boolean }> {
  const parsed = z.object({ analytics: z.boolean(), marketing: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const jar = await cookies();
  jar.set(CONSENT_COOKIE, serializeConsent({ v: 1, ...parsed.data, decidedAt: new Date().toISOString() }), {
    path: "/", maxAge: CONSENT_MAX_AGE, sameSite: "lax", secure, httpOnly: false,
  });
  if (parsed.data.analytics) {
    if (!jar.get(SESSION_COOKIE)) jar.set(SESSION_COOKIE, crypto.randomUUID(), { path: "/", maxAge: 60 * 30, sameSite: "lax", secure, httpOnly: true });
  } else {
    jar.delete(SESSION_COOKIE);
  }
  return { ok: true };
}
