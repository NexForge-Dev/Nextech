import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { analytics } from "@/lib/analytics";

/** LGPD/GDPR data portability: everything we hold about the signed-in user, as JSON. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = await createServerSupabase();
  const [profile, favorites, history, orders, items, addresses, returns, feedback] = await Promise.all([
    sb.from("profiles").select("full_name, preferred_locale, preferred_market, history_enabled, consent, created_at, updated_at").eq("id", user.id).single(),
    sb.from("favorites").select("product_id, created_at, products(slug)"),
    sb.from("browsing_history").select("product_id, viewed_at, products(slug)").order("viewed_at", { ascending: false }),
    sb.from("my_orders").select("number, status, payment_method, subtotal_minor, discount_minor, total_minor, refunded_minor, shipping, created_at, paid_at, cancelled_at").order("created_at", { ascending: false }),
    sb.from("my_order_items").select("order_id, name, quantity, unit_price_minor, line_total_minor, tracking_code"),
    sb.from("customer_addresses").select("recipient_name, cpf, phone, cep, street, number, complement, district, city, state, created_at"),
    sb.from("return_requests").select("reason, message, status, outcome, outcome_note, created_at, resolved_at"),
    // an admin can read everyone's: keep the export to this account
    sb.from("product_feedback").select("kind, message, page, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  analytics.feature(user.id, "exportacao_dados");
  const body = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    profile: profile.data,
    favorites: favorites.data ?? [],
    browsing_history: history.data ?? [],
    orders: orders.data ?? [],
    order_items: items.data ?? [],
    saved_addresses: addresses.data ?? [],
    return_requests: returns.data ?? [],
    feedback: feedback.data ?? [],
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="nextech-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
