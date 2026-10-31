import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

export function proxy(request: NextRequest) {
  return intl(request);
}

export const config = {
  matcher: ["/((?!admin|go|api|auth|_next|_vercel|.*\..*).*)"],
};
