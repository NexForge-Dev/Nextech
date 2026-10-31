import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./src/lib/security/headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:55821");
const supabaseIsLocal = ["127.0.0.1", "localhost"].includes(supabaseUrl.hostname);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
        hostname: supabaseUrl.hostname,
        port: supabaseUrl.port,
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // only the local Supabase stack lives on a private IP
    dangerouslyAllowLocalIP: supabaseIsLocal,
  },
  // Classic caching model (unstable_cache + tags); pages read cookies (market, consent) per request.
  cacheComponents: false,
  poweredByHeader: false,
  // institutional Markdown is read from disk at request time
  outputFileTracingIncludes: { "/[locale]/**": ["./src/content/legal/**/*.md"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
