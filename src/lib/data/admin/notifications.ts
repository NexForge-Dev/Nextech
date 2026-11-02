import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { computeNotifications, type AdminNotification } from "@/lib/domain/notifications";
import type { AdminContext } from "@/lib/auth/permissions";

/** Real-data notifications for the header, with per-admin read state. */
export async function getAdminNotifications(ctx: AdminContext): Promise<{ items: (AdminNotification & { read: boolean })[]; unread: number }> {
  const sb = await createServerSupabase();
  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 3_600_000).toISOString();
  const nowIso = now.toISOString();
  const canMarketing = ctx.permissions.has("marketing.write");
  const canOrders = ctx.permissions.has("orders.read");
  const [stale, offers, promos, banners, campaigns, syncs, msgs, products, reads, toBuy, returns] = await Promise.all([
    sb.from("site_settings").select("value").eq("key", "ops.price_stale_days").maybeSingle(),
    sb.from("affiliate_links").select("id, product_id, price_minor, price_updated_at, stores(price_display_policy, affiliate_networks(price_display_policy)), products(status, product_translations(locale, name))").eq("active", true).not("price_minor", "is", null).limit(500),
    canMarketing ? sb.from("promotions").select("id, starts_at, ends_at, products(product_translations(locale, name))").eq("active", true).or(`starts_at.lte.${soon},ends_at.lte.${soon}`).gte("ends_at", nowIso) : Promise.resolve({ data: [] }),
    canMarketing ? sb.from("banners").select("id, starts_at, ends_at, banner_translations(locale, title)").eq("active", true).or(`starts_at.lte.${soon},ends_at.lte.${soon}`) : Promise.resolve({ data: [] }),
    canMarketing ? sb.from("campaigns").select("id, name, starts_at, ends_at").in("status", ["scheduled", "active"]) : Promise.resolve({ data: [] }),
    ctx.permissions.has("networks.read") ? sb.from("network_sync_runs").select("network_id, started_at, ok, affiliate_networks(name)").eq("ok", false).gte("started_at", new Date(now.getTime() - 7 * 86_400_000).toISOString()).order("started_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    ctx.permissions.has("customers.read") ? sb.from("contact_messages").select("id", { count: "exact", head: true }).eq("handled", false) : Promise.resolve({ count: 0 }),
    // own-store products are sold here and never have affiliate offers
    sb.from("products").select("id, product_translations(locale, name), affiliate_links(id, active)").eq("status", "published").eq("sale_mode", "affiliate").limit(500),
    sb.from("admin_notification_reads").select("notification_key"),
    // order tables have no browser policies: counted with the service role after the permission check
    canOrders ? createServiceSupabase().from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "awaiting_supplier"]) : Promise.resolve({ count: 0 }),
    canOrders ? createServiceSupabase().from("return_requests").select("id", { count: "exact", head: true }).eq("status", "open") : Promise.resolve({ count: 0 }),
  ]);
  type T = { locale: string; name?: string; title?: string }[];
  const nameOf = (t: T | undefined) => t?.find((x) => x.locale === "pt-BR")?.name ?? t?.[0]?.name ?? "—";
  const items = computeNotifications({
    now,
    staleDays: Number(stale.data?.value ?? 14) || 14,
    offers: ((offers.data ?? []) as unknown as { id: string; product_id: string; price_minor: number | null; price_updated_at: string | null; stores: { price_display_policy: string | null; affiliate_networks: { price_display_policy: string } | null } | null; products: { status: string; product_translations: T } | null }[])
      .filter((o) => o.products?.status === "published")
      .map((o) => ({
        id: o.id,
        productId: o.product_id,
        productName: nameOf(o.products?.product_translations),
        priceUpdatedAt: o.price_updated_at,
        policy: (o.stores?.price_display_policy ?? o.stores?.affiliate_networks?.price_display_policy ?? "show") === "link_only" ? ("link_only" as const) : ("show" as const),
        hasPrice: o.price_minor != null,
      })),
    schedules: [
      ...((promos.data ?? []) as unknown as { id: string; starts_at: string; ends_at: string; products: { product_translations: T } | null }[]).map((p) => ({ kind: "promotion" as const, id: p.id, name: nameOf(p.products?.product_translations), startsAt: p.starts_at, endsAt: p.ends_at })),
      ...((banners.data ?? []) as unknown as { id: string; starts_at: string | null; ends_at: string | null; banner_translations: T }[]).map((b) => ({ kind: "banner" as const, id: b.id, name: b.banner_translations.find((x) => x.locale === "pt-BR")?.title ?? "Banner", startsAt: b.starts_at, endsAt: b.ends_at })),
      ...((campaigns.data ?? []) as { id: string; name: string; starts_at: string | null; ends_at: string | null }[]).map((c) => ({ kind: "campaign" as const, id: c.id, name: c.name, startsAt: c.starts_at, endsAt: c.ends_at })),
    ],
    failedSyncs: ((syncs.data ?? []) as unknown as { network_id: string; started_at: string; affiliate_networks: { name: string } | null }[]).map((s) => ({ networkId: s.network_id, networkName: s.affiliate_networks?.name ?? "Rede", at: s.started_at })),
    unhandledMessages: (msgs as { count: number | null }).count ?? 0,
    ordersToBuy: (toBuy as { count: number | null }).count ?? 0,
    openReturns: (returns as { count: number | null }).count ?? 0,
    productsWithoutOffer: ((products.data ?? []) as unknown as { id: string; product_translations: T; affiliate_links: { active: boolean }[] }[])
      .filter((p) => !p.affiliate_links.some((l) => l.active))
      .slice(0, 20)
      .map((p) => ({ id: p.id, name: nameOf(p.product_translations) })),
  });
  const readKeys = new Set((reads.data ?? []).map((r) => r.notification_key));
  const withRead = items.slice(0, 50).map((n) => ({ ...n, read: readKeys.has(n.key) }));
  return { items: withRead, unread: withRead.filter((n) => !n.read).length };
}
