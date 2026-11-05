import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createServiceSupabase } from "@/lib/supabase/service";

export const LIMITS = {
  go: { windowSeconds: 60, max: 60 },
  suggest: { windowSeconds: 10, max: 30 },
  contact: { windowSeconds: 3600, max: 5 },
  auth: { windowSeconds: 600, max: 10 },
  checkout: { windowSeconds: 600, max: 15 },
  orders: { windowSeconds: 600, max: 20 },
  feedback: { windowSeconds: 3600, max: 10 },
  expireHolds: { windowSeconds: 60, max: 1 },
} as const;
export type LimitBucket = keyof typeof LIMITS;

/** Abuse-sensitive buckets refuse when the limiter itself is down; tracking/search ones stay open. */
const FAIL_CLOSED: ReadonlySet<LimitBucket> = new Set(["auth", "contact", "checkout", "orders", "feedback", "expireHolds"]);

export async function clientIp(): Promise<string> {
  const h = await headers();
  // platform-set headers first (Vercel overwrites these; a client cannot spoof them there)
  return h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Fixed-window limit in Postgres (works across serverless instances). On DB errors only FAIL_CLOSED buckets refuse. */
export async function rateLimit(bucket: LimitBucket, ip?: string): Promise<boolean> {
  const addr = ip ?? (await clientIp());
  // local development / automated tests on loopback are not throttled; production always is
  if (process.env.NODE_ENV !== "production" && ["::1", "127.0.0.1", "::ffff:127.0.0.1", "unknown"].includes(addr)) return true;
  const key = createHash("sha256").update(`${addr}|${bucket}`).digest("hex").slice(0, 40);
  const { windowSeconds, max } = LIMITS[bucket];
  try {
    const { data, error } = await createServiceSupabase().rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
    if (error) return !FAIL_CLOSED.has(bucket);
    return data !== false;
  } catch {
    return !FAIL_CLOSED.has(bucket);
  }
}
