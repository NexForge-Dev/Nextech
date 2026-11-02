import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://nextech.example";
});

describe("buildMetadata", () => {
  it("builds canonical and hreflang alternates for a product", async () => {
    const { buildMetadata } = await import("@/lib/seo/metadata");
    const m = buildMetadata({ locale: "en", href: { pathname: "/produto/[slug]", params: { slug: "x" } }, title: "X" });
    expect(String(m.alternates?.canonical)).toBe("https://nextech.example/en/product/x");
    const langs = m.alternates?.languages as Record<string, string>;
    expect(langs["pt-PT"]).toBe("https://nextech.example/pt-pt/produto/x");
    expect(langs.es).toBe("https://nextech.example/es/producto/x");
    expect(langs["x-default"]).toBe("https://nextech.example/pt-br/produto/x");
  });
  it("lists only the served locales while the storefront is locked to pt-BR", async () => {
    const { buildMetadata } = await import("@/lib/seo/metadata");
    const m = buildMetadata({ locale: "pt-BR", locales: ["pt-BR"], href: { pathname: "/produto/[slug]", params: { slug: "x" } }, title: "X" });
    expect(String(m.alternates?.canonical)).toBe("https://nextech.example/pt-br/produto/x");
    expect(m.alternates?.languages).toEqual({ "pt-BR": "https://nextech.example/pt-br/produto/x", "x-default": "https://nextech.example/pt-br/produto/x" });
  });
  it("canonicalises a locale the storefront does not serve to the primary one", async () => {
    const { buildMetadata } = await import("@/lib/seo/metadata");
    const m = buildMetadata({ locale: "en", locales: ["pt-BR"], href: "/termos", title: "T" });
    expect(String(m.alternates?.canonical)).toBe("https://nextech.example/pt-br/termos");
  });
  it("marks noindex pages", async () => {
    const { buildMetadata } = await import("@/lib/seo/metadata");
    const m = buildMetadata({ locale: "pt-BR", href: "/favoritos", title: "F", noindex: true });
    expect(m.robots).toMatchObject({ index: false });
  });
});

describe("robots", () => {
  it("disallows admin, go and api", async () => {
    const robots = (await import("@/app/robots")).default;
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    const dis = ([] as string[]).concat(rules.disallow ?? []);
    expect(dis).toEqual(expect.arrayContaining(["/admin", "/go/", "/api/", "/pt-br/carrinho", "/pt-br/checkout"]));
    expect(r.sitemap).toBe("https://nextech.example/sitemap.xml");
  });
});

describe("listing metadata", () => {
  it("treats paging and ad-click ids as non-filters and canonicalises deeper pages to themselves", async () => {
    const { buildMetadata, isFilteredQuery, pageParam } = await import("@/lib/seo/metadata");
    expect(isFilteredQuery({ page: "2", utm_source: "x", gclid: "y", fbclid: "z" })).toBe(false);
    expect(isFilteredQuery({ sort: "price_asc" })).toBe(true);
    expect(pageParam({ page: "3" })).toBe(3);
    expect(pageParam({ page: "abc" })).toBe(1);
    const m = buildMetadata({ locale: "pt-BR", locales: ["pt-BR"], href: "/produtos", title: "P", page: 2 });
    expect(String(m.alternates?.canonical)).toMatch(/\/produtos\?page=2$/);
    expect(String(buildMetadata({ locale: "pt-BR", locales: ["pt-BR"], href: "/produtos", title: "P", page: 1 }).alternates?.canonical)).toMatch(/\/produtos$/);
  });
});
