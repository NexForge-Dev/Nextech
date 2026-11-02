import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/domain/safe-next";
import { analytics } from "@/lib/analytics";

/** Email confirmation / password recovery links land here with a PKCE code. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = safeNextPath(req.nextUrl.searchParams.get("next")) ?? "/";
  if (code) {
    const sb = await createServerSupabase();
    const { data } = await sb.auth.exchangeCodeForSession(code);
    // A confirmed sign-up (not a password recovery): one-time events, repeats are dropped by the panel.
    if (data?.user?.email_confirmed_at && !data.user.recovery_sent_at) {
      analytics.step(data.user.id, "email_confirmado");
      analytics.signupCompleted(data.user.id);
    }
  }
  return NextResponse.redirect(new URL(next, req.nextUrl.origin));
}
