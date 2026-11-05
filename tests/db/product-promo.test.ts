import { describe, it, expect, beforeAll } from "vitest";
import { createAdmin, createUser, anonClient, serviceClient, uniq, type DB } from "./helpers";

const address = { recipientName: "Ana Souza", cpf: "52998224725", phone: "11999999999", cep: "01310100", street: "Av. Paulista", number: "1000", district: "Bela Vista", city: "São Paulo", state: "SP" };
const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();

let admin: { id: string; client: DB };
let buyer: { id: string; client: DB };
let categoryId: string;

const payload = (slug: string, promo: Record<string, unknown>, id?: string) => ({
  id,
  slug,
  categoryId,
  status: "published",
  featured: false,
  tags: [],
  specs: [],
  translations: { "pt-BR": { name: `Fone ${slug}`, shortDescription: "", descriptionMd: "", specs: [] } },
  images: [],
  offers: [],
  replaceOffers: true,
  saleMode: "own",
  sale: { priceMinor: 20000, compareAtMinor: null, pixDiscountPct: 0, available: true, deliveryMinDays: 3, deliveryMaxDays: 7, ...promo },
  suppliers: [],
});

async function save(slug: string, promo: Record<string, unknown>, id?: string) {
  const { data, error } = await admin.client.rpc("admin_save_product_promo", { p: payload(slug, promo, id) as never });
  expect(error).toBeNull();
  return data as string;
}

const orderTotal = async (productId: string) => {
  const { data, error } = await buyer.client.rpc("create_order_from_cart", { p_items: [{ productId, quantity: 2 }] as never, p_address: address as never, p_method: "card" });
  expect(error).toBeNull();
  return Number(data![0].total_minor);
};

const searched = async (slug: string) => {
  const { data, error } = await anonClient().rpc("search_products", { q: "", p_locale: "pt-BR", p_market: "BR", p_limit: 100 });
  expect(error).toBeNull();
  return data!.find((r) => r.slug === slug);
};

beforeAll(async () => {
  admin = await createAdmin("promo-admin@nextech.local", "admin");
  buyer = await createUser("promo-buyer@nextech.local");
  const { data: cat } = await serviceClient().from("categories").insert({ slug: uniq("cat-promo"), sort_order: 99 }).select("id").single();
  categoryId = cat!.id;
  await serviceClient().from("site_settings").update({ value: { own_store: true, affiliates: false, own_stock: false, dropshipping: true, payments: { card: true, boleto: true, pix: false } } }).eq("key", "public.business_models");
});

describe("timed promotion", () => {
  it("charges and lists the promo price while it runs", async () => {
    const slug = uniq("promo-on");
    const id = await save(slug, { promoPriceMinor: 15000, promoStartsAt: hours(-1), promoEndsAt: hours(1) });
    expect(await orderTotal(id)).toBe(30000);
    expect(await searched(slug)).toMatchObject({ best_price_minor: 15000, discount: 25 });
  });

  it("charges the regular price before it starts", async () => {
    const slug = uniq("promo-soon");
    const id = await save(slug, { promoPriceMinor: 15000, promoStartsAt: hours(1), promoEndsAt: hours(3) });
    expect(await orderTotal(id)).toBe(40000);
    expect(await searched(slug)).toMatchObject({ best_price_minor: 20000, discount: null });
  });

  it("returns to the regular price after it ends", async () => {
    const slug = uniq("promo-over");
    const id = await save(slug, { promoPriceMinor: 15000, promoStartsAt: hours(-3), promoEndsAt: hours(-1) });
    expect(await orderTotal(id)).toBe(40000);
    expect(await searched(slug)).toMatchObject({ best_price_minor: 20000, discount: null });
  });

  it("clears the promotion when saved empty", async () => {
    const slug = uniq("promo-clear");
    const id = await save(slug, { promoPriceMinor: 15000, promoStartsAt: hours(-1), promoEndsAt: hours(1) });
    await save(slug, { promoPriceMinor: null, promoStartsAt: null, promoEndsAt: null }, id);
    const { data } = await serviceClient().from("product_sale").select("promo_price_minor, promo_ends_at").eq("product_id", id).single();
    expect(data).toEqual({ promo_price_minor: null, promo_ends_at: null });
  });

  it("refuses a half-filled promotion or an end before the start", async () => {
    const svc = serviceClient();
    const id = await save(uniq("promo-bad"), {});
    expect((await svc.from("product_sale").update({ promo_price_minor: 100 }).eq("product_id", id)).error).not.toBeNull();
    expect((await svc.from("product_sale").update({ promo_price_minor: 100, promo_starts_at: hours(2), promo_ends_at: hours(1) }).eq("product_id", id)).error).not.toBeNull();
  });

  it("keeps the save behind the products.write permission", async () => {
    const editor = await createAdmin("promo-editor@nextech.local", "editor");
    const svc = serviceClient();
    await svc.from("admin_users").update({ active: false }).eq("user_id", editor.id);
    const { error } = await editor.client.rpc("admin_save_product_promo", { p: payload(uniq("promo-denied"), {}) as never });
    await svc.from("admin_users").update({ active: true }).eq("user_id", editor.id);
    expect(error).not.toBeNull();
  });
});
