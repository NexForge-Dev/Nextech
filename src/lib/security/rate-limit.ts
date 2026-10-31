import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createServiceSupabase } from "@/lib/supabase/service";

export const LIMITS = {
  go: { windowSeconds: 60, max: 60 },
  suggest: { windowSeconds: 10, max: 30 },
  contact: { windowSeconds: 3600, max: 5 },
  auth: { windowSeconds: 600, max: 10 },
} as const;
export type LimitBucket = keyof typeof LIMITS;

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Fixed-window limit in Postgres (works across serverless instances). Fails open on DB errors. */
export async function rateLimit(bucket: LimitBucket, ip?: string): Promise<boolean> {
  const addr = ip ?? (await clientIp());
  const key = createHash("sha256").update(`${addr}|${bucket}`).digest("hex").slice(0, 40);
  const { windowSeconds, max } = LIMITS[bucket];
  try {
    const { data, error } = await createServiceSupabase().rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}
