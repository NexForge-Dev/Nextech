"use server";
import { updateTag } from "next/cache";
import { z } from "zod";
import { adminAction, ActionFailure } from "@/lib/admin/action";
import { auditDiff } from "@/lib/admin/audit-diff";
import { createServerSupabase } from "@/lib/supabase/server";
import { bannerSchema, campaignSchema, promotionSchema } from "@/lib/admin/schemas/marketing";
import { LOCALE_CODES } from "@/lib/admin/schemas/common";

const idSchema = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------- promotions
const savePromotionImpl = adminAction({ permission: "marketing.write", schema: promotionSchema, audit: { action: "save", entity: "promotions" } }, async (p) => {
  const sb = await createServerSupabase();
  if (!p.reason) {
    // a promotion without a stated reason must show a discount that is actually proven
    const { data: links } = await sb.from("affiliate_links").select("market").eq("product_id", p.productId).eq("active", true);
    let proven = false;
    for (const m of [...new Set((links ?? []).map((l) => l.market))]) {
      const { data } = await sb.rpc("product_market_price", { p_product: p.productId, p_market: m });
      if (data?.[0]?.discount) proven = true;
    }
    if (!proven) throw new ActionFailure("invalid", "Este produto não tem desconto comprovado.", { reason: ["Informe o motivo da oferta (ex.: “Black Friday na Loja X”) — o produto não tem desconto comprovado."] });
  }
  const row = { product_id: p.productId, link_id: p.linkId, reason: p.reason || null, starts_at: p.startsAt, ends_at: p.endsAt, publish_at: p.publishAt, highlighted: p.highlighted, active: p.active };
  const before = p.id ? (await sb.from("promotions").select("*").eq("id", p.id).single()).data : null;
  const { data, error } = p.id ? await sb.from("promotions").update(row).eq("id", p.id).select("*").single() : await sb.from("promotions").insert(row).select("*").single();
  if (error) throw error;
  updateTag("catalog");
  return { id: data.id, audit: auditDiff(before, data) };
});
export async function savePromotion(input: unknown) {
  return savePromotionImpl(input);
}

const deletePromotionImpl = adminAction({ permission: "marketing.write", schema: idSchema, audit: { action: "delete", entity: "promotions" } }, async ({ id }) => {
  const sb = await createServerSupabase();
  const { error } = await sb.from("promotions").delete().eq("id", id);
  if (error) throw error;
  updateTag("catalog");
  return { id };
});
export async function deletePromotion(input: unknown) {
  return deletePromotionImpl(input);
}

// ---------------------------------------------------------------- banners
const saveBannerImpl = adminAction({ permission: "marketing.write", schema: bannerSchema, audit: { action: "save", entity: "banners" } }, async (b) => {
  const sb = await createServerSupabase();
  const row = { image_path: b.imagePath, mobile_image_path: b.mobileImagePath, link_url: b.linkUrl, starts_at: b.startsAt, ends_at: b.endsAt, sort_order: b.sortOrder, active: b.active, campaign_id: b.campaignId };
  const before = b.id ? (await sb.from("banners").select("*").eq("id", b.id).single()).data : null;
  const { data, error } = b.id ? await sb.from("banners").update(row).eq("id", b.id).select("*").single() : await sb.from("banners").insert(row).select("*").single();
  if (error) throw error;
  for (const l of LOCALE_CODES) {
    const t = b.translations[l];
    if (t) {
      const { error: te } = await sb.from("banner_translations").upsert({ banner_id: data.id, locale: l, title: t.title, subtitle: t.subtitle || null }, { onConflict: "banner_id,locale" });
      if (te) throw te;
    } else await sb.from("banner_translations").delete().eq("banner_id", data.id).eq("locale", l);
  }
  if (b.campaignId) await sb.from("campaign_banners").upsert({ campaign_id: b.campaignId, banner_id: data.id }, { onConflict: "campaign_id,banner_id", ignoreDuplicates: true });
  updateTag("catalog");
  return { id: data.id, audit: auditDiff(before, data) };
});
export async function saveBanner(input: unknown) {
  return saveBannerImpl(input);
}

const deleteBannerImpl = adminAction({ permission: "marketing.write", schema: idSchema, audit: { action: "delete", entity: "banners" } }, async ({ id }) => {
  const sb = await createServerSupabase();
  const { error } = await sb.from("banners").delete().eq("id", id);
  if (error) throw error;
  updateTag("catalog");
  return { id };
});
export async function deleteBanner(input: unknown) {
  return deleteBannerImpl(input);
}

// ---------------------------------------------------------------- campaigns
const saveCampaignImpl = adminAction({ permission: "marketing.write", schema: campaignSchema, audit: { action: "save", entity: "campaigns" } }, async (c) => {
  const sb = await createServerSupabase();
  const row = { slug: c.slug, name: c.name, starts_at: c.startsAt, ends_at: c.endsAt, status: c.status };
  const before = c.id ? (await sb.from("campaigns").select("*").eq("id", c.id).single()).data : null;
  const { data, error } = c.id ? await sb.from("campaigns").update(row).eq("id", c.id).select("*").single() : await sb.from("campaigns").insert(row).select("*").single();
  if (error) throw error;
  for (const l of LOCALE_CODES) {
    const t = c.translations[l];
    if (t) {
      const { error: te } = await sb.from("campaign_translations").upsert({ campaign_id: data.id, locale: l, title: t.title, description: t.description || null }, { onConflict: "campaign_id,locale" });
      if (te) throw te;
    } else await sb.from("campaign_translations").delete().eq("campaign_id", data.id).eq("locale", l);
  }
  await sb.from("campaign_products").delete().eq("campaign_id", data.id);
  if (c.productIds.length) {
    const { error: pe } = await sb.from("campaign_products").insert(c.productIds.map((product_id, i) => ({ campaign_id: data.id, product_id, sort_order: i })));
    if (pe) throw pe;
  }
  await sb.from("campaign_banners").delete().eq("campaign_id", data.id);
  if (c.bannerIds.length) {
    const { error: be } = await sb.from("campaign_banners").insert(c.bannerIds.map((banner_id) => ({ campaign_id: data.id, banner_id })));
    if (be) throw be;
  }
  updateTag("catalog");
  return { id: data.id, audit: { ...auditDiff(before, data), products: c.productIds.length, banners: c.bannerIds.length } };
});
export async function saveCampaign(input: unknown) {
  return saveCampaignImpl(input);
}

const deleteCampaignImpl = adminAction({ permission: "marketing.write", schema: idSchema, audit: { action: "delete", entity: "campaigns" } }, async ({ id }) => {
  const sb = await createServerSupabase();
  const { error } = await sb.from("campaigns").delete().eq("id", id);
  if (error) throw error;
  updateTag("catalog");
  return { id };
});
export async function deleteCampaign(input: unknown) {
  return deleteCampaignImpl(input);
}
