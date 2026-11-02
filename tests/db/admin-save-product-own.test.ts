import { describe, it, expect, beforeAll } from "vitest";
import { createAdmin, serviceClient, uniq, type DB } from "./helpers";

let admin: { id: string; client: DB };
let editorNoWrite: { id: string; client: DB };
let categoryId: string;
let sup: Record<string, string>;

const payload = (slug: string, suppliers: unknown[]) => ({
  slug,
  categoryId,
  status: "published",
  featured: false,
  tags: [],
  specs: [],
  translations: { "pt-BR": { name: "Fone próprio", shortDescription: "", descriptionMd: "", specs: [] } },
  images: [],
  offers: [],
  replaceOffers: true,
  saleMode: "own",
  sale: { priceMinor: 24990, compareAtMinor: 29990, pixDiscountPct: 5, available: true, deliveryMinDays: 3, deliveryMaxDays: 7 },
  suppliers,
});

beforeAll(async () => {
  admin = await createAdmin("own-admin@nextech.local", "admin");
  editorNoWrite = await createAdmin("own-editor@nextech.local", "editor");
  const svc = serviceClient();
  const { data: cat } = await svc.from("categories").insert({ slug: uniq("cat-own"), sort_order: 99 }).select("id").single();
  categoryId = cat!.id;
  const { data: rows } = await svc.from("suppliers").select("id, slug");
  sup = Object.fromEntries((rows ?? []).map((r) => [r.slug, r.id]));
});

describe("admin_save_product_full", () => {
  it("writes the sale data and suppliers of an own product", async () => {
    const slug = uniq("p-own");
    const { data: id, error } = await admin.client.rpc("admin_save_product_full", {
      p: payload(slug, [
        { supplierId: sup["amazon-br"], url: "https://www.amazon.com.br/dp/X", costMinor: 16500, isPrimary: true, notes: null },
        { supplierId: sup["mercado-livre"], url: null, costMinor: 17200, isPrimary: false, notes: null },
      ]) as never,
    });
    expect(error).toBeNull();
    const svc = serviceClient();
    expect((await svc.from("products").select("sale_mode").eq("id", id!).single()).data?.sale_mode).toBe("own");
    expect((await svc.from("product_sale").select("price_minor, pix_discount_pct").eq("product_id", id!).single()).data).toEqual({ price_minor: 24990, pix_discount_pct: 5 });
    expect((await svc.from("product_suppliers").select("supplier_id").eq("product_id", id!)).data).toHaveLength(2);

    const { error: e2 } = await admin.client.rpc("admin_save_product_full", {
      p: { ...payload(slug, [{ supplierId: sup["amazon-br"], url: null, costMinor: 15000, isPrimary: true, notes: null }]), id } as never,
    });
    expect(e2).toBeNull();
    expect((await svc.from("product_suppliers").select("cost_minor").eq("product_id", id!)).data).toEqual([{ cost_minor: 15000 }]);
  });

  it("rejects an own product without sale data", async () => {
    const { error } = await admin.client.rpc("admin_save_product_full", { p: { ...payload(uniq("p-own"), []), sale: null } as never });
    expect(error).not.toBeNull();
  });

  it("is refused for an inactive admin (no products.write)", async () => {
    const outsider = editorNoWrite.client;
    const svc = serviceClient();
    await svc.from("admin_users").update({ active: false }).eq("user_id", editorNoWrite.id);
    const { error } = await outsider.rpc("admin_save_product_full", { p: payload(uniq("p-own"), []) as never });
    await svc.from("admin_users").update({ active: true }).eq("user_id", editorNoWrite.id);
    expect(error).not.toBeNull();
  });
});
