"use server";
import { updateTag } from "next/cache";
import { z } from "zod";
import { adminAction, ActionFailure } from "@/lib/admin/action";
import { auditDiff } from "@/lib/admin/audit-diff";
import { createServerSupabase } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/admin/schemas/category";
import { brandSchema } from "@/lib/admin/schemas/brand";
import { domainSchema, storeSchema } from "@/lib/admin/schemas/store";
import { LOCALE_CODES } from "@/lib/admin/schemas/common";

function bust(...tags: string[]) {
  for (const t of tags) updateTag(t);
}

// ---------------------------------------------------------------- categories
const saveCategoryImpl = adminAction({ permission: "categories.write", schema: categorySchema, audit: { action: "save", entity: "categories" } }, async (input) => {
  const sb = await createServerSupabase();
  const before = input.id ? (await sb.from("categories").select("*").eq("id", input.id).single()).data : null;
  const row = { slug: input.slug, icon: input.icon, image_path: input.imagePath, sort_order: input.sortOrder, active: input.active };
  const { data, error } = input.id ? await sb.from("categories").update(row).eq("id", input.id).select("*").single() : await sb.from("categories").insert(row).select("*").single();
  if (error) throw error;
  for (const l of LOCALE_CODES) {
    const t = input.translations[l];
    if (t) {
      const { error: te } = await sb.from("category_translations").upsert({ category_id: data.id, locale: l, name: t.name, description: t.description || null }, { onConflict: "category_id,locale" });
      if (te) throw te;
    } else {
      await sb.from("category_translations").delete().eq("category_id", data.id).eq("locale", l);
    }
  }
  bust("catalog", "categories");
  return { id: data.id, audit: auditDiff(before, data) };
});
export async function saveCategory(input: unknown) {
  return saveCategoryImpl(input);
}

const deleteCategoryImpl = adminAction({ permission: "categories.write", schema: z.object({ id: z.string().uuid() }), audit: { action: "delete", entity: "categories" } }, async ({ id }) => {
  const sb = await createServerSupabase();
  const { count } = await sb.from("products").select("id", { count: "exact", head: true }).eq("category_id", id);
  if (count) throw new ActionFailure("conflict", `Mova os ${count} produto(s) desta categoria antes de excluí-la.`);
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) throw error;
  bust("catalog", "categories");
  return { id };
});
export async function deleteCategory(input: unknown) {
  return deleteCategoryImpl(input);
}

const moveCategoryImpl = adminAction({ permission: "categories.write", schema: z.object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) }) }, async ({ id, direction }) => {
  const sb = await createServerSupabase();
  const { data: all } = await sb.from("categories").select("id, sort_order").order("sort_order").order("slug");
  const list = all ?? [];
  const i = list.findIndex((c) => c.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { id };
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) {
    if (list[k].sort_order !== (k + 1) * 10) await sb.from("categories").update({ sort_order: (k + 1) * 10 }).eq("id", list[k].id);
  }
  bust("catalog", "categories");
  return { id };
});
export async function moveCategory(input: unknown) {
  return moveCategoryImpl(input);
}

// ---------------------------------------------------------------- brands
const saveBrandImpl = adminAction({ permission: "brands.write", schema: brandSchema, audit: { action: "save", entity: "brands" } }, async (input) => {
  const sb = await createServerSupabase();
  const before = input.id ? (await sb.from("brands").select("*").eq("id", input.id).single()).data : null;
  const row = { name: input.name, slug: input.slug, logo_path: input.logoPath, active: input.active };
  const { data, error } = input.id ? await sb.from("brands").update(row).eq("id", input.id).select("*").single() : await sb.from("brands").insert(row).select("*").single();
  if (error) throw error;
  bust("catalog");
  return { id: data.id, audit: auditDiff(before, data) };
});
export async function saveBrand(input: unknown) {
  return saveBrandImpl(input);
}

const deleteBrandImpl = adminAction({ permission: "brands.write", schema: z.object({ id: z.string().uuid() }), audit: { action: "delete", entity: "brands" } }, async ({ id }) => {
  const sb = await createServerSupabase();
  const { error } = await sb.from("brands").delete().eq("id", id);
  if (error) throw error;
  bust("catalog");
  return { id };
});
export async function deleteBrand(input: unknown) {
  return deleteBrandImpl(input);
}

// ---------------------------------------------------------------- stores
const saveStoreImpl = adminAction({ permission: "stores.write", schema: storeSchema, audit: { action: "save", entity: "stores" } }, async (input) => {
  const sb = await createServerSupabase();
  const before = input.id ? (await sb.from("stores").select("*").eq("id", input.id).single()).data : null;
  const row = {
    name: input.name,
    slug: input.slug,
    logo_path: input.logoPath,
    official_url: input.officialUrl,
    description: input.description || null,
    network_id: input.networkId,
    markets: input.markets,
    price_display_policy: input.priceDisplayPolicy === "inherit" ? null : input.priceDisplayPolicy,
    active: input.active,
  };
  const { data, error } = input.id ? await sb.from("stores").update(row).eq("id", input.id).select("*").single() : await sb.from("stores").insert(row).select("*").single();
  if (error) throw error;
  await sb.from("store_domains").delete().eq("store_id", data.id).not("domain", "in", `(${input.domains.map((d) => `"${d}"`).join(",")})`);
  const { error: de } = await sb.from("store_domains").upsert(input.domains.map((domain) => ({ store_id: data.id, domain })), { onConflict: "store_id,domain", ignoreDuplicates: true });
  if (de) throw de;
  bust("catalog", "stores");
  return { id: data.id, audit: { ...auditDiff(before, data), domains: input.domains } };
});
export async function saveStore(input: unknown) {
  return saveStoreImpl(input);
}

const deleteStoreImpl = adminAction({ permission: "stores.write", schema: z.object({ id: z.string().uuid() }), audit: { action: "delete", entity: "stores" } }, async ({ id }) => {
  const sb = await createServerSupabase();
  const { count } = await sb.from("affiliate_links").select("id", { count: "exact", head: true }).eq("store_id", id);
  if (count) throw new ActionFailure("conflict", `Esta loja tem ${count} link(s) de afiliado. Remova-os ou desative a loja.`);
  const { error } = await sb.from("stores").delete().eq("id", id);
  if (error) throw error;
  bust("catalog", "stores");
  return { id };
});
export async function deleteStore(input: unknown) {
  return deleteStoreImpl(input);
}

const addStoreDomainImpl = adminAction({ permission: "stores.write", schema: z.object({ storeId: z.string().uuid(), domain: domainSchema }), audit: { action: "add_domain", entity: "stores" } }, async ({ storeId, domain }) => {
  const sb = await createServerSupabase();
  const { error } = await sb.from("store_domains").upsert({ store_id: storeId, domain }, { onConflict: "store_id,domain", ignoreDuplicates: true });
  if (error) throw error;
  return { id: storeId, domain, audit: { domain } };
});
export async function addStoreDomain(input: unknown) {
  return addStoreDomainImpl(input);
}
