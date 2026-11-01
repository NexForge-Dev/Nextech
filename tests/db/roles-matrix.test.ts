import { describe, it, expect, beforeAll } from "vitest";
import { createAdmin, type DB } from "./helpers";

const ALL = [
  "products.write", "products.delete", "products.import", "links.write", "links.delete", "stores.write",
  "categories.write", "brands.write", "networks.read", "networks.write", "marketing.write", "analytics.read",
  "conversions.import", "customers.read", "customers.export", "settings.write", "admins.write", "audit.read",
] as const;

const MATRIX: Record<"superadmin" | "admin" | "editor", readonly string[]> = {
  superadmin: ALL,
  admin: ALL.filter((p) => !["networks.write", "settings.write", "admins.write", "customers.export"].includes(p)),
  editor: ["products.write", "links.write", "categories.write", "brands.write", "marketing.write"],
};

const clients: Record<string, DB> = {};

beforeAll(async () => {
  for (const role of Object.keys(MATRIX) as (keyof typeof MATRIX)[]) {
    clients[role] = (await createAdmin(`matrix-${role}@nextech.local`, role)).client;
  }
});

describe("role × permission matrix", () => {
  for (const role of Object.keys(MATRIX) as (keyof typeof MATRIX)[]) {
    for (const perm of ALL) {
      const expected = MATRIX[role].includes(perm);
      it(`${role} ${expected ? "has" : "lacks"} ${perm}`, async () => {
        const { data, error } = await clients[role].rpc("has_admin_permission", { p: perm });
        expect(error).toBeNull();
        expect(data).toBe(expected);
      });
    }
  }
  it("seeds the four launch markets as active", async () => {
    const { data } = await clients.superadmin.from("markets").select("code").eq("active", true).order("code");
    expect(data?.map((m) => m.code)).toEqual(["BR", "ES", "PT", "US"]);
  });
  it("seeds 10 categories with 4 translations each", async () => {
    const { data } = await clients.superadmin.from("categories").select("slug, category_translations(locale)");
    const seeded = (data ?? []).filter((c) => c.category_translations.length === 4);
    expect(seeded.length).toBeGreaterThanOrEqual(10);
  });
  it("seeds Amazon as link_only", async () => {
    const { data } = await clients.superadmin.from("affiliate_networks").select("price_display_policy").eq("key", "amazon").single();
    expect(data?.price_display_policy).toBe("link_only");
  });
});
