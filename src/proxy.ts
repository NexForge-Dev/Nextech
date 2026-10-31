import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

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
    // 3. store pages: locale routing
    response = intl(request);
  }
  for (const c of pending) response.cookies.set(c.name, c.value, c.options);
  return response;
}

export const config = {
  // Skip /go, /api, Next internals and any path containing a file extension.
  matcher: ["/((?!go(?:/|$)|api/|_next/|_vercel/|.*\\.[a-zA-Z0-9]+$).*)"],
};
