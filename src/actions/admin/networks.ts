"use server";
import { updateTag } from "next/cache";
import { z } from "zod";
import { adminAction, ActionFailure } from "@/lib/admin/action";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { encryptCredentials } from "@/lib/security/credentials-crypto";
import { getAdapter, ADAPTER_KEYS } from "@/lib/affiliates/registry";
import { loadNetworkSecrets, storeConversions, syncAmazonPrices, syncNetwork } from "@/lib/affiliates/sync";
import { slugSchema } from "@/lib/admin/schemas/common";

const id = z.object({ id: z.string().uuid() });

const saveNetworkImpl = adminAction(
  {
    permission: "networks.write",
    schema: z.object({
      id: z.string().uuid().optional(),
      key: slugSchema,
      adapter: z.enum(ADAPTER_KEYS as [string, ...string[]]),
      name: z.string().trim().min(1, "Informe o nome.").max(80),
      subidParam: z.string().trim().max(40).regex(/^[A-Za-z0-9_]*$/, "Use apenas letras, números e _.").optional().default(""),
      priceDisplayPolicy: z.enum(["show", "link_only"]),
      settings: z.record(z.string(), z.string().max(500)).default({}),
      active: z.boolean(),
    }),
    audit: { action: "save", entity: "affiliate_networks" },
  },
  async (i) => {
    const sb = await createServerSupabase();
    const adapter = getAdapter(i.adapter);
    const allowed = new Set(adapter.settingsFields.map((f) => f.name));
    const settings = Object.fromEntries(Object.entries(i.settings).filter(([k, v]) => allowed.has(k) && v.trim()).map(([k, v]) => [k, v.trim()]));
    const row = { key: i.key, adapter: i.adapter, name: i.name, subid_param: i.subidParam || null, price_display_policy: i.priceDisplayPolicy, settings, active: i.active };
    const { data, error } = i.id ? await sb.from("affiliate_networks").update(row).eq("id", i.id).select("id").single() : await sb.from("affiliate_networks").insert(row).select("id").single();
    if (error) throw error;
    updateTag("catalog");
    return { id: data.id, audit: { key: i.key, adapter: i.adapter, active: i.active, settings: Object.keys(settings) } };
  },
);
export async function saveNetwork(input: unknown) {
  return saveNetworkImpl(input);
}

const saveCredentialsImpl = adminAction(
  { permission: "networks.write", schema: z.object({ id: z.string().uuid(), values: z.record(z.string(), z.string().max(2000)) }), audit: { action: "credentials_update", entity: "affiliate_networks" } },
  async ({ id: networkId, values }, ctx) => {
    const sb = await createServerSupabase();
    const { data: net } = await sb.from("affiliate_networks").select("adapter").eq("id", networkId).single();
    const adapter = getAdapter(net?.adapter ?? "");
    const fields = adapter.credentialFields.map((f) => f.name);
    // keep previously stored values for fields left blank
    const previous = await loadNetworkSecrets(networkId);
    const merged = Object.fromEntries(fields.map((f) => [f, values[f]?.trim() || previous[f] || ""]));
    const missing = adapter.credentialFields.filter((f) => !merged[f.name]).map((f) => f.label);
    if (missing.length) throw new ActionFailure("invalid", `Preencha: ${missing.join(", ")}.`);
    const enc = encryptCredentials(merged);
    const { error } = await createServiceSupabase().from("network_credentials").upsert({ network_id: networkId, ...enc, updated_by: ctx.userId }, { onConflict: "network_id" });
    if (error) throw error;
    return { id: networkId, audit: { fields } };
  },
);
export async function saveCredentials(input: unknown) {
  return saveCredentialsImpl(input);
}

const removeCredentialsImpl = adminAction({ permission: "networks.write", schema: id, audit: { action: "credentials_remove", entity: "affiliate_networks" } }, async ({ id: networkId }) => {
  const { error } = await createServiceSupabase().from("network_credentials").delete().eq("network_id", networkId);
  if (error) throw error;
  return { id: networkId };
});
export async function removeCredentials(input: unknown) {
  return removeCredentialsImpl(input);
}

const testImpl = adminAction({ permission: "networks.write", schema: id }, async ({ id: networkId }) => {
  const sb = await createServerSupabase();
  const { data: net } = await sb.from("affiliate_networks").select("adapter, settings").eq("id", networkId).single();
  const adapter = getAdapter(net?.adapter ?? "");
  if (!adapter.testConnection) throw new ActionFailure("invalid", `${adapter.label} não tem teste de conexão por API.`);
  return { id: networkId, ...(await adapter.testConnection(await loadNetworkSecrets(networkId), (net?.settings ?? {}) as Record<string, string>)) };
});
export async function testNetworkConnection(input: unknown) {
  return testImpl(input);
}

const syncImpl = adminAction({ permission: "networks.write", schema: z.object({ id: z.string().uuid(), days: z.number().int().min(1).max(365).default(30) }), audit: { action: "sync", entity: "affiliate_networks" } }, async ({ id: networkId, days }) => {
  const sb = await createServerSupabase();
  const { data: net } = await sb.from("affiliate_networks").select("adapter").eq("id", networkId).single();
  if (net?.adapter === "amazon_paapi") {
    const r = await syncAmazonPrices(networkId);
    if (!r.ok) throw new ActionFailure("server", `Falha: ${r.error}`);
    return { id: networkId, inserted: 0, updated: r.updated, audit: { prices: r.updated } };
  }
  const to = new Date();
  const r = await syncNetwork(networkId, { from: new Date(to.getTime() - days * 86_400_000), to });
  if (!r.ok) throw new ActionFailure("server", `Falha na sincronização: ${r.error}`);
  return { id: networkId, inserted: r.inserted, updated: r.updated, audit: { inserted: r.inserted, updated: r.updated } };
});
export async function syncNow(input: unknown) {
  return syncImpl(input);
}

const importImpl = adminAction(
  {
    permission: "conversions.import",
    schema: z.object({
      id: z.string().uuid(),
      text: z.string().max(10_000_000),
      filename: z.string().max(200),
      commit: z.boolean(),
      currency: z.string().regex(/^[A-Z]{3}$/).optional(),
      mapping: z.object({ externalId: z.string(), date: z.string(), status: z.string(), saleAmount: z.string(), commission: z.string(), currency: z.string(), clickRef: z.string().optional() }).optional(),
      statusMap: z.record(z.string(), z.enum(["pending", "confirmed", "rejected"])).optional(),
    }),
    audit: { action: "import_conversions", entity: "affiliate_networks" },
  },
  async (i) => {
    const sb = await createServerSupabase();
    const { data: net } = await sb.from("affiliate_networks").select("adapter").eq("id", i.id).single();
    const adapter = getAdapter(net?.adapter ?? "generic");
    const parser = adapter.parseReportCsv ?? getAdapter("generic").parseReportCsv!;
    const parsed = parser(i.text, { currency: i.currency, mapping: i.mapping, statusMap: i.statusMap });
    if (!i.commit) return { id: i.id, rows: parsed.rows.length, errors: parsed.errors.slice(0, 100), inserted: 0, updated: 0, committed: false };
    if (parsed.errors.length) throw new ActionFailure("invalid", `Corrija os ${parsed.errors.length} erro(s) antes de importar.`);
    const service = createServiceSupabase();
    const { data: run } = await service.from("network_sync_runs").insert({ network_id: i.id, kind: "csv" }).select("id").single();
    const r = await storeConversions(i.id, parsed.rows, "import", i.filename);
    await service.from("network_sync_runs").update({ finished_at: new Date().toISOString(), ok: true, inserted: r.inserted, updated: r.updated }).eq("id", run!.id);
    return { id: i.id, rows: parsed.rows.length, errors: [], ...r, committed: true, audit: { filename: i.filename, ...r } };
  },
);
export async function importConversions(input: unknown) {
  return importImpl(input);
}

const generateImpl = adminAction(
  { permission: "links.write", schema: z.object({ networkId: z.string().uuid(), originalUrl: z.string().url(), market: z.string().regex(/^[A-Z]{2}$/) }) },
  async ({ networkId, originalUrl, market }) => {
    const sb = await createServerSupabase();
    const { data: net } = await sb.from("affiliate_networks").select("adapter, settings").eq("id", networkId).single();
    const adapter = getAdapter(net?.adapter ?? "");
    if (!adapter.buildAffiliateUrl) throw new ActionFailure("invalid", `${adapter.label} não gera links automaticamente. Cole o link de afiliado gerado no painel da rede.`);
    try {
      return { id: networkId, url: adapter.buildAffiliateUrl(originalUrl, { market, settings: (net?.settings ?? {}) as Record<string, string> }) };
    } catch (e) {
      throw new ActionFailure("invalid", e instanceof Error ? e.message : "Não foi possível gerar o link.");
    }
  },
);
export async function generateAffiliateUrl(input: unknown) {
  return generateImpl(input);
}
