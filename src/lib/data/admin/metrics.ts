import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { groupByCurrency, type CurrencyAmount } from "@/lib/domain/aggregates";
import type { Period } from "@/lib/domain/period";

export type MetricFilters = { product?: string; category?: string; campaign?: string; network?: string };
export type Point = { key: string; label: string; value: number };
export type CommissionPoint = { day: string; status: string; currency: string; amountMinor: number };

const uuidOrNull = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);

function fillDays(points: Point[], from: Date, to: Date): Point[] {
  const byDay = new Map(points.map((p) => [p.key, p.value]));
  const out: Point[] = [];
  const shift = 3 * 3_600_000; // America/Sao_Paulo
  for (let t = from.getTime() - shift; t <= to.getTime() - shift; t += 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10);
    out.push({ key: d, label: d, value: byDay.get(d) ?? 0 });
  }
  return out;
}

export async function getMetrics(period: Period, f: MetricFilters = {}) {
  const sb = await createServerSupabase();
  const base = { p_from: period.from.toISOString(), p_to: period.to.toISOString() };
  const flt = { p_product: uuidOrNull(f.product), p_category: uuidOrNull(f.category), p_campaign: uuidOrNull(f.campaign), p_network: uuidOrNull(f.network) };
  const viewFlt = { p_product: flt.p_product, p_category: flt.p_category };
  const [clicksDay, clicksProduct, clicksCategory, clicksStore, clicksNetwork, clicksCampaign, viewsDay, viewsProduct, commissions, commissionsDaily, conversions] = await Promise.all([
    sb.rpc("metrics_clicks", { ...base, p_group: "day", ...flt }),
    sb.rpc("metrics_clicks", { ...base, p_group: "product", ...flt }),
    sb.rpc("metrics_clicks", { ...base, p_group: "category", ...flt }),
    sb.rpc("metrics_clicks", { ...base, p_group: "store", ...flt }),
    sb.rpc("metrics_clicks", { ...base, p_group: "network", ...flt }),
    sb.rpc("metrics_clicks", { ...base, p_group: "campaign", ...flt }),
    sb.rpc("metrics_views", { ...base, p_group: "day", ...viewFlt }),
    sb.rpc("metrics_views", { ...base, p_group: "product", ...viewFlt }),
    sb.rpc("metrics_commissions", { ...base, p_by_day: false, ...flt }),
    sb.rpc("metrics_commissions", { ...base, p_by_day: true, ...flt }),
    sb.rpc("metrics_conversions_count", { ...base, ...flt }),
  ]);
  const pts = (r: { data: { key: string; label: string; value: number }[] | null }) => (r.data ?? []).map((x) => ({ key: x.key ?? "", label: x.label, value: Number(x.value) }));
  const clicksByDay = fillDays(pts(clicksDay), period.from, period.to);
  const viewsByDay = fillDays(pts(viewsDay), period.from, period.to);
  const totalClicks = clicksByDay.reduce((n, p) => n + p.value, 0);
  const totalViews = viewsByDay.reduce((n, p) => n + p.value, 0);
  const commissionRows = (commissions.data ?? []).map((c) => ({ amountMinor: Number(c.amount_minor), currency: c.currency, status: c.status }));
  const viewMap = new Map(pts(viewsProduct).map((p) => [p.key, p.value]));
  const clickMap = new Map(pts(clicksProduct).map((p) => [p.key, p.value]));
  const productKeys = [...new Set([...clickMap.keys(), ...viewMap.keys()])].filter((k) => k && k !== "null");
  const names = new Map([...pts(clicksProduct), ...pts(viewsProduct)].map((p) => [p.key, p.label]));
  const topProducts = productKeys
    .map((k) => ({ id: k, name: names.get(k) ?? "—", views: viewMap.get(k) ?? 0, clicks: clickMap.get(k) ?? 0 }))
    .map((r) => ({ ...r, ctr: r.views ? r.clicks / r.views : null }))
    .sort((a, b) => b.clicks - a.clicks || b.views - a.views)
    .slice(0, 10);
  return {
    totalClicks,
    totalViews,
    ctr: totalViews ? totalClicks / totalViews : null,
    conversions: Number(conversions.data ?? 0),
    commissions: groupByCurrency(commissionRows) as Record<"pending" | "confirmed" | "rejected", CurrencyAmount[]>,
    commissionsDaily: (commissionsDaily.data ?? []).map((c) => ({ day: c.day ?? "", status: c.status, currency: c.currency, amountMinor: Number(c.amount_minor) })) as CommissionPoint[],
    clicksByDay,
    viewsByDay,
    clicksByCategory: pts(clicksCategory).slice(0, 10),
    clicksByStore: pts(clicksStore).slice(0, 10),
    clicksByNetwork: pts(clicksNetwork).slice(0, 10),
    clicksByCampaign: pts(clicksCampaign).filter((p) => p.key && p.key !== "null").slice(0, 10),
    viewsByProduct: pts(viewsProduct).slice(0, 10),
    topProducts,
  };
}

export async function getCatalogCounts() {
  const sb = await createServerSupabase();
  const [total, active, inactive, categories, allClicks] = await Promise.all([
    sb.from("products").select("id", { count: "exact", head: true }),
    sb.from("products").select("id", { count: "exact", head: true }).eq("status", "published"),
    sb.from("products").select("id", { count: "exact", head: true }).neq("status", "published"),
    sb.from("categories").select("id", { count: "exact", head: true }),
    sb.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("is_bot", false),
  ]);
  return { total: total.count ?? 0, active: active.count ?? 0, inactive: inactive.count ?? 0, categories: categories.count ?? 0, allClicks: allClicks.count ?? 0 };
}
