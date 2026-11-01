import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/security/cron";

/** Daily (Vercel Cron): roll up and delete raw events older than 13 months (privacy policy). */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { createServiceSupabase } = await import("@/lib/supabase/service");
  const { log } = await import("@/lib/log");
  const { data, error } = await createServiceSupabase().rpc("run_retention");
  if (error) {
    log.error("cron.retention_failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  log.info("cron.retention", data as Record<string, unknown>);
  return NextResponse.json({ ok: true, result: data });
}
