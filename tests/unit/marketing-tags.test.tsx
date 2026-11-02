import { describe, it, expect } from "vitest";
import { Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { AnalyticsScripts } from "@/components/store/analytics-scripts";
import { MarketingTracker, isBuyLink } from "@/components/store/marketing-tracker";
import { settingsSchema } from "@/lib/admin/schemas/settings";

type AnyProps = { src?: string; id?: string; children?: ReactNode; pixel?: boolean; googleAdsSendTo?: string | null };

function collect(node: ReactNode, out: ReactElement<AnyProps>[] = []): ReactElement<AnyProps>[] {
  if (Array.isArray(node)) node.forEach((n) => collect(n, out));
  else if (isValidElement<AnyProps>(node)) {
    if (node.type !== Fragment) out.push(node);
    collect(node.props.children, out);
  }
  return out;
}

const tags = { ga4: "G-ABC123", plausible: "", googleAds: "AW-123456789", googleAdsConversion: "AbC-dEf_123", metaPixel: "1234567890123456" };
const render = (consented: boolean, marketing: boolean, extra: Partial<typeof tags> = {}) => collect(AnalyticsScripts({ consented, marketing, ...tags, ...extra }));
const srcs = (els: ReactElement<AnyProps>[]) => els.map((e) => e.props.src).filter(Boolean);
const inline = (els: ReactElement<AnyProps>[]) => els.map((e) => (typeof e.props.children === "string" ? e.props.children : "")).join("\n");

describe("marketing tags", () => {
  it("loads nothing without consent", () => {
    expect(render(false, false)).toHaveLength(0);
  });

  it("loads only GA4 with analytics consent alone", () => {
    const els = render(true, false);
    expect(srcs(els)).toEqual(["https://www.googletagmanager.com/gtag/js?id=G-ABC123"]);
    expect(inline(els)).not.toContain("AW-");
    expect(inline(els)).not.toContain("fbq");
    expect(els.some((e) => e.type === MarketingTracker)).toBe(false);
  });

  it("loads Google Ads and the Meta Pixel only with marketing consent", () => {
    const els = render(false, true);
    expect(srcs(els)).toEqual(["https://www.googletagmanager.com/gtag/js?id=AW-123456789"]);
    expect(inline(els)).toContain("gtag('config','AW-123456789')");
    expect(inline(els)).not.toContain("G-ABC123");
    expect(inline(els)).toContain("fbq('init','1234567890123456')");
    const tracker = els.find((e) => e.type === MarketingTracker);
    expect(tracker?.props).toMatchObject({ pixel: true, googleAdsSendTo: "AW-123456789/AbC-dEf_123" });
  });

  it("shares one gtag.js between GA4 and Google Ads", () => {
    const els = render(true, true);
    expect(srcs(els)).toEqual(["https://www.googletagmanager.com/gtag/js?id=G-ABC123"]);
    expect(inline(els)).toContain("gtag('config','G-ABC123'");
    expect(inline(els)).toContain("gtag('config','AW-123456789')");
  });

  it("ignores malformed ids instead of injecting them", () => {
    const els = render(true, true, { ga4: "", googleAds: "AW-1');alert(1);//", metaPixel: "abc" });
    expect(els).toHaveLength(0);
  });

  it("skips the conversion when no label is set", () => {
    const tracker = render(false, true, { googleAdsConversion: "" }).find((e) => e.type === MarketingTracker);
    expect(tracker?.props.googleAdsSendTo).toBeNull();
  });
});

describe("isBuyLink", () => {
  const origin = "https://nextech.example";
  it("matches the outbound redirect", () => expect(isBuyLink("/go/abc?offer=1", origin)).toBe(true));
  it("ignores other pages", () => expect(isBuyLink("/es/producto/x", origin)).toBe(false));
  it("ignores other sites", () => expect(isBuyLink("https://evil.example/go/abc", origin)).toBe(false));
  it("ignores empty hrefs", () => expect(isBuyLink(null, origin)).toBe(false));
});

describe("settings schema — ad tags", () => {
  const base = {
    storeName: "NEXTECH", contactEmail: "", logoPath: null, faviconPath: null, heroImage: null, institutional: {}, socials: {}, seo: {},
    analytics: { ga4: "", plausible: "" }, cookieTexts: {}, legal: { company_name: "", tax_id: "", address: "" }, priceStaleDays: 14,
  };
  const withAds = (a: Record<string, string>) => settingsSchema.safeParse({ ...base, analytics: { ...base.analytics, ...a } });

  it("keeps old settings valid (fields default to empty)", () => {
    const r = settingsSchema.safeParse(base);
    expect(r.success && r.data.analytics).toMatchObject({ googleAds: "", googleAdsConversion: "", metaPixel: "" });
  });
  it("accepts valid ids", () => expect(withAds({ googleAds: "AW-18550743752", googleAdsConversion: "AbC-dEf_123", metaPixel: "1234567890123456" }).success).toBe(true));
  it("rejects a GA4 id in the Google Ads field", () => expect(withAds({ googleAds: "G-ABC123" }).success).toBe(false));
  it("rejects a non-numeric pixel id", () => expect(withAds({ metaPixel: "fb-123" }).success).toBe(false));
  it("rejects a label with quotes", () => expect(withAds({ googleAdsConversion: "abc'def" }).success).toBe(false));
});

describe("trackAdEvent", () => {
  type Call = unknown[];
  const setup = (withTags = true) => {
    const fb: Call[] = [];
    const g: Call[] = [];
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
    (globalThis as Record<string, unknown>).window = withTags
      ? { fbq: (...a: unknown[]) => fb.push(a), gtag: (...a: unknown[]) => g.push(a), __nxAdsSendTo: "AW-1/abc" }
      : {};
    return { fb, g };
  };

  it("is a no-op without consented tags", async () => {
    setup(false);
    const { trackAdEvent } = await import("@/components/store/marketing-tracker");
    expect(() => trackAdEvent("AddToCart", { valueMinor: 24990, currency: "BRL", contentIds: ["x"] })).not.toThrow();
  });
  it("sends the value in reais to Meta", async () => {
    const { fb } = setup();
    const { trackAdEvent } = await import("@/components/store/marketing-tracker");
    trackAdEvent("AddToCart", { valueMinor: 43980, currency: "BRL", contentIds: ["x"] });
    expect(fb[0]).toEqual(["track", "AddToCart", { value: 439.8, currency: "BRL", content_ids: ["x"], content_type: "product" }]);
  });
  it("sends a purchase once per order, with the Google Ads conversion", async () => {
    const { fb, g } = setup();
    const { trackAdEvent } = await import("@/components/store/marketing-tracker");
    trackAdEvent("Purchase", { valueMinor: 43980, currency: "BRL", contentIds: ["x"], orderNumber: 1001 });
    trackAdEvent("Purchase", { valueMinor: 43980, currency: "BRL", contentIds: ["x"], orderNumber: 1001 });
    expect(fb).toHaveLength(1);
    expect(fb[0][3]).toEqual({ eventID: "order-1001" });
    expect(g).toEqual([["event", "conversion", { send_to: "AW-1/abc", value: 439.8, currency: "BRL", transaction_id: "1001" }]]);
  });
});
