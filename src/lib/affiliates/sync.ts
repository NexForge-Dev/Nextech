import "server-only";
import { createServiceSupabase } from "@/lib/supabase/service";
import { decryptCredentials } from "@/lib/security/credentials-crypto";
import { getAdapter } from "./registry";
import { planSync, type ExistingRow } from "./sync-core";
import type { ConversionStatus, NormalizedConversion } from "./types";

type Source = "integration" | "import";

export async function loadNetworkSecrets(networkId: string): Promise<Record<string, string>> {
  const sb = createServiceSupabase();
  const { data } = await sb.from("network_credentials").select("ciphertext, iv, tag").eq("network_id", networkId).maybeSingle();
  return data ? decryptCredentials(data) : {};
}

/** Idempotent upsert of conversions + commissions for one network. */
export async function storeConversions(networkId: string, items: NormalizedConversion[], source: Source, sourceRef: string): Promise<{ inserted: number; updated: number }> {
  const sb = createServiceSupabase();
  const ids = [...new Set(items.map((i) => i.externalId))];
  const existing = new Map<string, ExistingRow>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await sb.from("affiliate_commissions").select("external_id, status, amount_minor").eq("network_id", networkId).in("external_id", ids.slice(i, i + 500));
    for (const r of data ?? []) existing.set(r.external_id, { status: r.status as ConversionStatus, amountMinor: r.amount_minor });
  }
  const refs = [...new Set(items.map((i) => i.clickRef?.toLowerCase()).filter((x): x is string => !!x && /^[0-9a-f-]{36}$/.test(x)))];
  const known = new Set<string>();
  for (let i = 0; i < refs.length; i += 500) {
    const { data } = await sb.from("affiliate_clicks").select("id").in("id", refs.slice(i, i + 500));
    for (const r of data ?? []) known.add(r.id);
  }
  const plan = planSync(items, existing, known);
  const changed = plan.rows.filter((r) => r.change !== "same");
  if (!changed.length) return { inserted: 0, updated: 0 };

  const clickInfo = new Map<string, { product_id: string | null; campaign_id: string | null }>();
  const clickIds = changed.map((r) => r.clickId).filter((x): x is string => !!x);
  if (clickIds.length) {
    const { data } = await sb.from("affiliate_clicks").select("id, product_id, campaign_id").in("id", clickIds);
    for (const c of data ?? []) clickInfo.set(c.id, { product_id: c.product_id, campaign_id: c.campaign_id });
  }
  for (let i = 0; i < changed.length; i += 200) {
    const batch = changed.slice(i, i + 200);
    const { data: conv, error } = await sb
      .from("affiliate_conversions")
      .upsert(
        batch.map((r) => ({
          network_id: networkId,
          external_id: r.externalId,
          click_id: r.clickId,
          product_id: r.clickId ? (clickInfo.get(r.clickId)?.product_id ?? null) : null,
          campaign_id: r.clickId ? (clickInfo.get(r.clickId)?.campaign_id ?? null) : null,
          occurred_at: r.occurredAt,
          status: r.status,
          sale_amount_minor: r.saleAmountMinor,
          currency: r.currency,
          source,
          source_ref: sourceRef,
          raw: r.raw as never,
        })),
        { onConflict: "network_id,external_id" },
      )
      .select("id, external_id");
    if (error) throw error;
    const convId = new Map((conv ?? []).map((c) => [c.external_id, c.id]));
    const { error: ce } = await sb.from("affiliate_commissions").upsert(
      batch
        .filter((r) => r.commissionMinor != null)
        .map((r) => ({
          network_id: networkId,
          external_id: r.externalId,
          conversion_id: convId.get(r.externalId) ?? null,
          amount_minor: r.commissionMinor!,
          currency: r.currency,
          status: r.status,
          reported_at: r.occurredAt,
          source,
          source_ref: sourceRef,
        })),
      { onConflict: "network_id,external_id" },
    );
    if (ce) throw ce;
  }
  return { inserted: plan.inserted, updated: plan.updated };
}

/** Pull conversions from a network API and log the run. Never throws to the caller. */
export async function syncNetwork(networkId: string, range: { from: Date; to: Date }, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; inserted: number; updated: number; error?: string }> {
  const sb = createServiceSupabase();
  const { data: run } = await sb.from("network_sync_runs").insert({ network_id: networkId, kind: "api" }).select("id").single();
  try {
    const { data: net } = await sb.from("affiliate_networks").select("adapter, settings").eq("id", networkId).single();
    const adapter = getAdapter(net?.adapter ?? "generic");
    if (!adapter.fetchConversions) throw new Error(`${adapter.label} não oferece API de conversões; use a importação de relatório.`);
    const creds = await loadNetworkSecrets(networkId);
    const items = await adapter.fetchConversions(range, creds, (net?.settings ?? {}) as Record<string, string>, fetchImpl);
    const res = await storeConversions(networkId, items, "integration", `api:${run?.id ?? ""}`);
    await sb.from("network_sync_runs").update({ finished_at: new Date().toISOString(), ok: true, inserted: res.inserted, updated: res.updated }).eq("id", run!.id);
    return { ok: true, ...res };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (run) await sb.from("network_sync_runs").update({ finished_at: new Date().toISOString(), ok: false, error: message.slice(0, 500) }).eq("id", run.id);
    return { ok: false, inserted: 0, updated: 0, error: message };
  }
}

/** Refresh Amazon prices through PA-API for offers that have an ASIN (external_id). */
export async function syncAmazonPrices(networkId: string): Promise<{ ok: boolean; updated: number; error?: string }> {
  const sb = createServiceSupabase();
  const { data: run } = await sb.from("network_sync_runs").insert({ network_id: networkId, kind: "prices" }).select("id").single();
  try {
    const { data: net } = await sb.from("affiliate_networks").select("adapter, settings").eq("id", networkId).single();
    const adapter = getAdapter(net?.adapter ?? "");
    if (!adapter.fetchPrices) throw new Error("Esta rede não fornece preços.");
    const creds = await loadNetworkSecrets(networkId);
    const { data: amazonNets } = await sb.from("affiliate_networks").select("id").in("adapter", ["amazon", "amazon_paapi"]);
    const { data: links } = await sb.from("affiliate_links").select("id, market, currency, external_id, price_minor").in("network_id", (amazonNets ?? []).map((n) => n.id)).not("external_id", "is", null).eq("active", true).limit(2000);
    let updated = 0;
    const byMarket = new Map<string, typeof links>();
    for (const l of links ?? []) byMarket.set(l.market, [...(byMarket.get(l.market) ?? []), l]);
    for (const [market, list] of byMarket) {
      const prices = await adapter.fetchPrices(list!.map((l) => l.external_id!), market, creds, (net?.settings ?? {}) as Record<string, string>);
      const now = new Date().toISOString();
      for (const p of prices) {
        for (const l of list!.filter((x) => x.external_id === p.externalId)) {
          await sb.from("affiliate_links").update({ price_minor: p.priceMinor, currency: p.currency, price_updated_at: now, price_source: "integration" }).eq("id", l.id);
          if (l.price_minor !== p.priceMinor) await sb.from("product_prices").insert({ link_id: l.id, price_minor: p.priceMinor, currency: p.currency, observed_at: now, source: "integration", source_ref: "paapi" });
          updated++;
        }
      }
    }
    await sb.from("network_sync_runs").update({ finished_at: new Date().toISOString(), ok: true, updated }).eq("id", run!.id);
    return { ok: true, updated };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (run) await sb.from("network_sync_runs").update({ finished_at: new Date().toISOString(), ok: false, error: message.slice(0, 500) }).eq("id", run.id);
    return { ok: false, updated: 0, error: message };
  }
}
