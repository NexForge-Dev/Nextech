import { describe, it, expect } from "vitest";
import { promotionSchema, bannerSchema, campaignSchema, campaignStatusAt } from "@/lib/admin/schemas/marketing";

const P = "11111111-1111-4111-8111-111111111111";

describe("promotion schema", () => {
  const base = { productId: P, linkId: null, reason: "", startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-10T00:00:00Z", publishAt: "", highlighted: false, active: true };
  it("rejects end before start", () => {
    const r = promotionSchema.safeParse({ ...base, endsAt: "2026-10-01T00:00:00Z" });
    expect(!r.success && r.error.issues.some((i) => i.path.join(".") === "endsAt")).toBe(true);
  });
  it("parses dates", () => {
    const r = promotionSchema.safeParse(base);
    expect(r.success && r.data.startsAt).toMatch(/^2026-11-01/);
  });
});

describe("banner schema", () => {
  const base = { imagePath: "a.png", mobileImagePath: null, linkUrl: "", startsAt: "", endsAt: "", sortOrder: 0, active: false, campaignId: null, translations: { "pt-BR": { title: "Black Friday", subtitle: "" } } };
  it("rejects javascript: links", () => expect(bannerSchema.safeParse({ ...base, linkUrl: "javascript:alert(1)" }).success).toBe(false));
  it("accepts internal paths", () => expect(bannerSchema.safeParse({ ...base, linkUrl: "/pt-br/ofertas" }).success).toBe(true));
  it("accepts https links", () => expect(bannerSchema.safeParse({ ...base, linkUrl: "https://loja.com" }).success).toBe(true));
  it("rejects protocol-relative links", () => expect(bannerSchema.safeParse({ ...base, linkUrl: "//evil.com" }).success).toBe(false));
  it("requires an image", () => expect(bannerSchema.safeParse({ ...base, imagePath: "" }).success).toBe(false));
});

describe("campaign", () => {
  const base = { slug: "black-friday", name: "Black Friday", startsAt: "2026-11-20T00:00", endsAt: "2026-11-30T00:00", status: "scheduled", productIds: [P], bannerIds: [], translations: { "pt-BR": { title: "Black Friday", description: "" } } };
  it("accepts a valid campaign", () => expect(campaignSchema.safeParse(base).success).toBe(true));
  it("derives the effective status from dates", () => {
    expect(campaignStatusAt("active", "2026-11-20T00:00:00Z", "2026-11-30T00:00:00Z", new Date("2026-12-01T00:00:00Z"))).toBe("ended");
    expect(campaignStatusAt("scheduled", "2026-11-20T00:00:00Z", null, new Date("2026-11-21T00:00:00Z"))).toBe("active");
    expect(campaignStatusAt("draft", "2026-11-20T00:00:00Z", null, new Date("2026-11-21T00:00:00Z"))).toBe("draft");
  });
});
