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
    expect(dis).toEqual(expect.arrayContaining(["/admin", "/go/", "/api/"]));
    expect(r.sitemap).toBe("https://nextech.example/sitemap.xml");
  });
});
