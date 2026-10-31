import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

/** LGPD/GDPR data portability: everything we hold about the signed-in user, as JSON. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = await createServerSupabase();
  const [profile, favorites, history] = await Promise.all([
    sb.from("profiles").select("full_name, preferred_locale, preferred_market, history_enabled, consent, created_at, updated_at").eq("id", user.id).single(),
    sb.from("favorites").select("product_id, created_at, products(slug)"),
    sb.from("browsing_history").select("product_id, viewed_at, products(slug)").order("viewed_at", { ascending: false }),
  ]);
  const body = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    profile: profile.data,
    favorites: favorites.data ?? [],
    browsing_history: history.data ?? [],
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="nextech-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
