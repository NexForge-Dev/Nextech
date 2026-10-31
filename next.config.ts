import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Classic caching model (unstable_cache + tags); pages read cookies (market, consent) per request.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
