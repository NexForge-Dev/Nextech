/** Static security headers for next.config. CSP allows Supabase (API + storage) and optional GA4/Plausible. */
export function securityHeaders(): { key: string; value: string }[] {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const isDev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://plausible.io`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase} https:`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabase.replace(/^http/, "ws")} https://www.google-analytics.com https://*.google-analytics.com https://plausible.io`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
  const list = [
    { key: "Content-Security-Policy", value: csp },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ];
  if (!isDev) list.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
  return list;
}
