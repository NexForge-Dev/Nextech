import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";
import { lockedLocalePath } from "./i18n/locale-lock";
import { parseBusinessModels } from "./lib/domain/business-models";

const intl = createMiddleware(routing);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Business-model switches, cached briefly per server instance (one small anon read at most every 30s).
let modelsCache: { at: number; affiliates: boolean } | null = null;
const MODELS_TTL_MS = Number(process.env.BUSINESS_MODELS_PROXY_TTL_MS ?? 30_000);
async function affiliatesEnabled(supabase: ReturnType<typeof createServerClient>): Promise<boolean> {
  if (modelsCache && Date.now() - modelsCache.at < MODELS_TTL_MS) return modelsCache.affiliates;
  const { data } = await supabase.from("site_settings").select("value").eq("key", "public.business_models").maybeSingle();
  const affiliates = parseBusinessModels(data?.value).affiliates;
  modelsCache = { at: Date.now(), affiliates };
  return affiliates;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAuthRoute = pathname.startsWith("/auth/");

  // 1. refresh the Supabase session (cookies) for every page request
  const pending: { name: string; value: string; options?: Record<string, unknown> }[] = [];
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const c of list) {
          request.cookies.set(c.name, c.value);
          pending.push(c);
        }
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  // 2. admin area: must be signed in (permission checks happen server-side per page/action)
  let response: NextResponse;
  if (isAdmin) {
    const isLogin = pathname === "/admin/entrar";
    if (!data.user && !isLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/entrar";
      url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname)}`;
      response = NextResponse.redirect(url);
    } else {
      response = NextResponse.next({ request });
    }
  } else if (isAuthRoute) {
    response = NextResponse.next({ request });
  } else {
    // 3. store pages: own store only (affiliates off) → pt-BR only; then locale routing
    const target = lockedLocalePath(pathname);
    if (target && !(await affiliatesEnabled(supabase))) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      response = NextResponse.redirect(url);
      response.cookies.set("NEXT_LOCALE", "pt-BR", { path: "/", sameSite: "lax" });
    } else {
      response = intl(request);
    }
  }
  for (const c of pending) response.cookies.set(c.name, c.value, c.options);
  return response;
}

export const config = {
  // Skip /go, /api, Next internals and any path containing a file extension.
  matcher: ["/((?!go(?:/|$)|api/|_next/|_vercel/|.*\\.[a-zA-Z0-9]+$).*)"],
};
