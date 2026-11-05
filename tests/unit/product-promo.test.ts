import { describe, it, expect } from "vitest";
import { formatCountdown, ownDiscountPct, ownSaleNow, promoFromRow } from "@/lib/domain/own-pricing";
import { addHoursToInput, fromBrasiliaInput, toBrasiliaInput } from "@/lib/domain/brasilia-time";
import { autoDealProducts, type DealRow } from "@/lib/domain/storefront";
import { productInputSchema } from "@/lib/admin/schemas/product";

const promo = { priceMinor: 15000, startsAt: "2026-10-23T23:00:00.000Z", endsAt: "2026-10-24T01:00:00.000Z" };
const base = { priceMinor: 20000, compareAtMinor: null, promo };
const at = (iso: string) => new Date(iso);

describe("ownSaleNow", () => {
  it("keeps the regular price before the promotion starts", () => {
    expect(ownSaleNow(base, at("2026-10-23T22:59:59.000Z"))).toEqual({ priceMinor: 20000, compareAtMinor: null, promoEndsAt: null });
  });
  it("charges the promo price and crosses out the regular one while it runs", () => {
    const now = ownSaleNow(base, at("2026-10-23T23:00:00.000Z"));
    expect(now).toEqual({ priceMinor: 15000, compareAtMinor: 20000, promoEndsAt: promo.endsAt });
    expect(ownDiscountPct(now)).toBe(25);
  });
  it("returns to the regular price the moment it ends", () => {
    expect(ownSaleNow(base, at("2026-10-24T01:00:00.000Z"))).toEqual({ priceMinor: 20000, compareAtMinor: null, promoEndsAt: null });
  });
  it("keeps the product's own 'de' price outside the promotion", () => {
    expect(ownSaleNow({ ...base, compareAtMinor: 25000 }, at("2026-10-25T00:00:00.000Z")).compareAtMinor).toBe(25000);
  });
  it("ignores a promotion that is no longer below the price", () => {
    expect(ownSaleNow({ ...base, priceMinor: 14000 }, at("2026-10-24T00:00:00.000Z")).priceMinor).toBe(14000);
  });
});

describe("promoFromRow", () => {
  it("needs all three columns", () => {
    expect(promoFromRow({ promo_price_minor: 100, promo_starts_at: null, promo_ends_at: "x" })).toBeNull();
    expect(promoFromRow({ promo_price_minor: 100, promo_starts_at: "a", promo_ends_at: "b" })).toEqual({ priceMinor: 100, startsAt: "a", endsAt: "b" });
  });
});

describe("formatCountdown", () => {
  it("shows hours, minutes and seconds", () => expect(formatCountdown(2 * 3600 + 13 * 60 + 5)).toBe("02:13:05"));
  it("shows days only when there are any", () => expect(formatCountdown(86_400 + 3661)).toBe("1d 01:01:01"));
  it("never goes below zero", () => expect(formatCountdown(-5)).toBe("00:00:00"));
});

describe("Brasília time", () => {
  it("reads what the admin types as Brasília time", () => {
    expect(fromBrasiliaInput("2026-10-23T20:00")).toBe("2026-10-23T23:00:00.000Z");
  });
  it("round-trips through the form", () => {
    expect(toBrasiliaInput("2026-10-23T23:00:00+00:00")).toBe("2026-10-23T20:00");
  });
  it("adds a duration across midnight", () => {
    expect(addHoursToInput("2026-10-23T23:00", 2)).toBe("2026-10-24T01:00");
  });
  it("rejects anything that is not a date", () => {
    expect(fromBrasiliaInput("")).toBeNull();
    expect(fromBrasiliaInput("23/10/2026 20:00")).toBeNull();
    expect(toBrasiliaInput(null)).toBe("");
  });
});

describe("autoDealProducts with a promotion", () => {
  const models = { ownStore: true, ownStock: false, dropshipping: true, affiliates: false };
  const row: DealRow<{ id: string }> = { price_minor: 20000, compare_at_minor: null, promo_price_minor: 15000, promo_starts_at: promo.startsAt, promo_ends_at: promo.endsAt, available: true, fulfillment: "dropship", stock_quantity: null, products: { id: "a" } };
  it("is an offer only while it runs", () => {
    expect(autoDealProducts([row], models, at("2026-10-24T00:00:00.000Z"))).toEqual([{ id: "a" }]);
    expect(autoDealProducts([row], models, at("2026-10-23T00:00:00.000Z"))).toEqual([]);
    expect(autoDealProducts([row], models, at("2026-10-25T00:00:00.000Z"))).toEqual([]);
  });
});

describe("productInputSchema promotion", () => {
  const product = {
    slug: "fone",
    categoryId: "11111111-1111-4111-8111-111111111111",
    status: "draft",
    translations: { "pt-BR": { name: "Fone" } },
    saleMode: "own",
  };
  const parse = (sale: Record<string, unknown>) => productInputSchema.safeParse({ ...product, sale: { price: "200,00", ...sale } });
  const issue = (r: ReturnType<typeof parse>, path: string) => (!r.success ? r.error.issues.find((i) => i.path.join(".") === path)?.message : undefined);
  const full = { promoPrice: "150,00", promoStartsAt: "2026-10-23T20:00", promoEndsAt: "2026-10-23T22:00" };

  it("turns the form values into centavos and instants", () => {
    const r = parse(full);
    expect(r.success && r.data.sale).toMatchObject({ priceMinor: 20000, promoPriceMinor: 15000, promoStartsAt: "2026-10-23T23:00:00.000Z", promoEndsAt: "2026-10-24T01:00:00.000Z" });
  });
  it("saves no promotion when the fields are empty", () => {
    const r = parse({});
    expect(r.success && r.data.sale).toMatchObject({ promoPriceMinor: null, promoStartsAt: null, promoEndsAt: null });
  });
  it("needs the promo price below the regular price", () => {
    expect(issue(parse({ ...full, promoPrice: "200,00" }), "sale.promoPrice")).toBe("A promoção precisa ser menor que o preço de venda.");
  });
  it("needs all the fields together", () => {
    expect(issue(parse({ promoPrice: "150,00" }), "sale.promoStartsAt")).toBe("Informe o início.");
    expect(issue(parse({ promoStartsAt: full.promoStartsAt }), "sale.promoPrice")).toBe("Informe o preço promocional.");
  });
  it("needs the end after the start", () => {
    expect(issue(parse({ ...full, promoEndsAt: "2026-10-23T19:00" }), "sale.promoEndsAt")).toBe("O término precisa ser depois do início.");
  });
});
