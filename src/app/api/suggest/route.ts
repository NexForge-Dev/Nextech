import { NextResponse, type NextRequest } from "next/server";
import { getPathname } from "@/i18n/navigation";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/routing";
import { suggest } from "@/lib/data/catalog";
import { rateLimit } from "@/lib/security/rate-limit";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const raw = req.nextUrl.searchParams.get("locale") ?? DEFAULT_LOCALE;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  if (q.length < 2) return NextResponse.json({ items: [] });
  if (!(await rateLimit("suggest"))) return NextResponse.json({ items: [] }, { status: 429 });
  const rows = await suggest(q, locale);
  const items = rows.map((r) => {
    const href =
      r.kind === "product"
        ? getPathname({ locale, href: { pathname: "/produto/[slug]", params: { slug: r.slug } } })
        : r.kind === "category"
          ? getPathname({ locale, href: { pathname: "/categoria/[slug]", params: { slug: r.slug } } })
          : getPathname({ locale, href: { pathname: "/produtos", query: { brand: r.slug } } });
    return { kind: r.kind, slug: r.slug, label: r.label, href };
  });
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
