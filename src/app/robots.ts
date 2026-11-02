import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/routing";
import { localizedPath, siteUrl } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  const privatePaths = LOCALES.flatMap((l) => [
    localizedPath(l, "/minha-conta"),
    localizedPath(l, "/favoritos"),
    localizedPath(l, "/entrar"),
    localizedPath(l, "/cadastro"),
    localizedPath(l, "/recuperar-senha"),
    localizedPath(l, "/redefinir-senha"),
    localizedPath(l, "/carrinho"),
    localizedPath(l, "/checkout"),
  ]);
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/go/", "/api/", "/auth/", ...new Set(privatePaths)] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
