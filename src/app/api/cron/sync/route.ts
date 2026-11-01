import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/security/cron";

/** Daily (Vercel Cron): sync conversions of every active API network for the last 30 days + PA-API prices. */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { createServiceSupabase } = await import("@/lib/supabase/service");
  const { syncAmazonPrices, syncNetwork } = await import("@/lib/affiliates/sync");
  const sb = createServiceSupabase();
  const { data: nets } = await sb.from("affiliate_networks").select("id, adapter, settings").eq("active", true);
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  const results: Record<string, unknown> = {};
  for (const n of nets ?? []) {
    if (["awin", "admitad", "impact"].includes(n.adapter)) results[n.id] = await syncNetwork(n.id, { from, to });
    if (n.adapter === "amazon_paapi" && (n.settings as Record<string, string>)?.enabled === "true") results[`${n.id}:prices`] = await syncAmazonPrices(n.id);
  }
  return NextResponse.json({ ok: true, results });
}
