import { describe, it, expect, beforeAll } from "vitest";
import { anonClient, createAdmin, createUser, makeProduct, serviceClient, type DB } from "./helpers";

let a: { id: string; client: DB };
let b: { id: string; client: DB };
let product: { id: string };
let draft: { id: string };

beforeAll(async () => {
  a = await createUser("rls-a@nextech.local");
  b = await createUser("rls-b@nextech.local");
  product = await makeProduct({ name: "Produto RLS" });
  draft = await makeProduct({ name: "Rascunho RLS", status: "draft" });
  await serviceClient().from("favorites").insert({ user_id: b.id, product_id: product.id });
});

describe("RLS — users", () => {
  it("a user cannot read another user's favorites", async () => {
    const { data } = await a.client.from("favorites").select("*").eq("user_id", b.id);
    expect(data).toEqual([]);
  });
  it("a user cannot insert a favorite for someone else", async () => {
    const { error } = await a.client.from("favorites").insert({ user_id: b.id, product_id: product.id });
    expect(error).not.toBeNull();
  });
  it("a user can manage their own favorites", async () => {
    const { error } = await a.client.from("favorites").insert({ user_id: a.id, product_id: product.id });
    expect(error).toBeNull();
    const { data } = await a.client.from("favorites").select("product_id");
    expect(data?.map((r) => r.product_id)).toContain(product.id);
  });
  it("a user only sees their own profile", async () => {
    const { data } = await a.client.from("profiles").select("id");
    expect(data?.map((r) => r.id)).toEqual([a.id]);
  });
  it("browsing history insert fails while history is disabled", async () => {
    const { error } = await a.client.from("browsing_history").insert({ user_id: a.id, product_id: product.id });
    expect(error).not.toBeNull();
  });
  it("browsing history insert works once enabled", async () => {
    await a.client.from("profiles").update({ history_enabled: true }).eq("id", a.id);
    const { error } = await a.client.from("browsing_history").insert({ user_id: a.id, product_id: product.id });
    expect(error).toBeNull();
  });
  it("a normal user cannot read admin_users", async () => {
    const { data } = await a.client.from("admin_users").select("*");
    expect(data).toEqual([]);
  });
});

describe("RLS — public catalogue", () => {
  it("anon cannot read a draft product", async () => {
    const { data } = await anonClient().from("products").select("id").eq("id", draft.id);
    expect(data).toEqual([]);
  });
  it("anon can read a published product and its translation", async () => {
    const { data } = await anonClient().from("products").select("id, product_translations(name)").eq("id", product.id);
    expect(data?.[0]?.product_translations?.[0]?.name).toBe("Produto RLS");
  });
  it("anon cannot read affiliate_clicks", async () => {
    const { data } = await anonClient().from("affiliate_clicks").select("*");
    expect(data).toEqual([]);
  });
  it("anon cannot insert affiliate_clicks", async () => {
    const { error } = await anonClient().from("affiliate_clicks").insert({ product_id: product.id });
    expect(error).not.toBeNull();
  });
  it("anon reads only public.* settings", async () => {
    const svc = serviceClient();
    await svc.from("site_settings").upsert([{ key: "public.test_flag", value: true }, { key: "ops.test_secret", value: 1 }]);
    const { data } = await anonClient().from("site_settings").select("key").in("key", ["public.test_flag", "ops.test_secret"]);
    expect(data?.map((r) => r.key)).toEqual(["public.test_flag"]);
  });
});

describe("RLS — admin roles", () => {
  it("an editor cannot update site settings", async () => {
    const editor = await createAdmin("rls-editor@nextech.local", "editor");
    const { data } = await editor.client.from("site_settings").update({ value: false }).eq("key", "public.test_flag").select();
    expect(data ?? []).toEqual([]);
  });
  it("an editor cannot read network credentials", async () => {
    const svc = serviceClient();
    const { data: net } = await svc.from("affiliate_networks").upsert({ key: "rls-net", adapter: "generic", name: "RLS" }, { onConflict: "key" }).select("id").single();
    await svc.from("network_credentials").upsert({ network_id: net!.id, ciphertext: "x", iv: "y", tag: "z" }, { onConflict: "network_id" });
    const editor = await createAdmin("rls-editor2@nextech.local", "editor");
    const { data } = await editor.client.from("network_credentials").select("*");
    expect(data).toEqual([]);
  });
  it("a superadmin cannot read network credentials either (service role only)", async () => {
    const sa = await createAdmin("rls-super@nextech.local", "superadmin");
    const { data } = await sa.client.from("network_credentials").select("*");
    expect(data).toEqual([]);
  });
  it("an editor can update a product but cannot delete it", async () => {
    const editor = await createAdmin("rls-editor3@nextech.local", "editor");
    const p = await makeProduct({ name: "Editável" });
    const upd = await editor.client.from("products").update({ featured: true }).eq("id", p.id).select("id");
    expect(upd.data?.length).toBe(1);
    await editor.client.from("products").delete().eq("id", p.id);
    const { data } = await serviceClient().from("products").select("id").eq("id", p.id);
    expect(data?.length).toBe(1);
  });
  it("an editor can read draft products", async () => {
    const editor = await createAdmin("rls-editor4@nextech.local", "editor");
    const { data } = await editor.client.from("products").select("id").eq("id", draft.id);
    expect(data?.length).toBe(1);
  });
  it("an admin can read clicks (analytics.read)", async () => {
    await serviceClient().from("affiliate_clicks").insert({ product_id: product.id });
    const admin = await createAdmin("rls-admin@nextech.local", "admin");
    const { data } = await admin.client.from("affiliate_clicks").select("id").eq("product_id", product.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
