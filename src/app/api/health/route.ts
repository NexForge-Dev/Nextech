import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { canTakePayments } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

/** For an uptime monitor: 503 when the database is down. `payments` says whether checkout can take money; no values, only presence. */
export async function GET() {
  let db = false;
  try {
    const { error } = await createServiceSupabase().from("site_settings").select("key").limit(1);
    db = !error;
  } catch {
    db = false;
  }
  return NextResponse.json({ ok: db, db, payments: canTakePayments() }, { status: db ? 200 : 503 });
}
