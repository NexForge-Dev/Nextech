import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { ADAPTER_KEYS, getAdapter } from "@/lib/affiliates/registry";
import { formatCurrencyAmounts, groupByCurrency } from "@/lib/domain/aggregates";
import { PageHeader } from "@/components/admin/page-header";
import { FormSection } from "@/components/admin/form";
import { CredentialsForm, NetworkForm, SyncButtons } from "@/components/admin/network-forms";
import { ButtonLink } from "@/components/admin/data-table";
import { daysAgoIso } from "@/lib/time";

export const metadata = { title: "Rede de afiliados" };

export default async function NetworkPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await pageGuard();
  if (!ctx.permissions.has("networks.read") && !ctx.permissions.has("networks.write")) await pageGuard("networks.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createServerSupabase();
  const since = daysAgoIso(30);
  const [{ data: n }, { data: cred }, { data: runs }, { count: clicks }, { data: commissions }, { count: conversions }, { data: links }] = await Promise.all([
    sb.from("affiliate_networks").select("id, key, name, adapter, subid_param, price_display_policy, settings, active").eq("id", id).maybeSingle(),
    createServiceSupabase().from("network_credentials").select("last4, updated_at").eq("network_id", id).maybeSingle(),
    sb.from("network_sync_runs").select("id, kind, started_at, finished_at, ok, inserted, updated, error").eq("network_id", id).order("started_at", { ascending: false }).limit(10),
    sb.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("network_id", id).eq("is_bot", false).gte("occurred_at", since),
    sb.from("affiliate_commissions").select("amount_minor, currency, status").eq("network_id", id).gte("reported_at", since),
    sb.from("affiliate_conversions").select("id", { count: "exact", head: true }).eq("network_id", id).gte("occurred_at", since),
    sb.from("affiliate_links").select("id, product_id, market, active, stores(name), products(product_translations(locale, name))").eq("network_id", id).limit(20),
  ]);
  if (!n) notFound();
  const adapter = getAdapter(n.adapter);
  const canWrite = ctx.permissions.has("networks.write");
  const g = groupByCurrency((commissions ?? []).map((c) => ({ amountMinor: c.amount_minor, currency: c.currency, status: c.status })));
  const adapters = ADAPTER_KEYS.map((k) => ({ key: k, label: getAdapter(k).label, settingsFields: getAdapter(k).settingsFields }));
  return (
    <>
      <PageHeader
        title={n.name}
        description={adapter.verification}
        actions={
          <>
            {ctx.permissions.has("conversions.import") && adapter.capabilities.csv && <ButtonLink href={`/admin/afiliados/${id}/importar`} variant="secondary">Importar relatório</ButtonLink>}
            <ButtonLink href={`/admin/afiliados/conversoes?network=${id}`} variant="secondary">Conversões</ButtonLink>
          </>
        }
      />
      <div className="mb-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Cliques (30 dias)", String(clicks ?? 0)],
          ["Conversões reportadas (30 dias)", String(conversions ?? 0)],
          ["Comissões estimadas (pendentes)", formatCurrencyAmounts(g.pending, "pt-BR")],
          ["Comissões confirmadas", formatCurrencyAmounts(g.confirmed, "pt-BR")],
          ["Rejeitadas", formatCurrencyAmounts(g.rejected, "pt-BR")],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-line p-4">
            <p className="text-xs text-mute">{label}</p>
            <p className="tabular mt-1 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="max-w-5xl">
        <NetworkForm
          canWrite={canWrite}
          adapters={adapters}
          initial={{ id: n.id, key: n.key, adapter: n.adapter, name: n.name, subidParam: n.subid_param ?? "", priceDisplayPolicy: n.price_display_policy as "show" | "link_only", settings: (n.settings ?? {}) as Record<string, string>, active: n.active }}
        />
        {canWrite && (
          <FormSection title="Credenciais" description="Necessárias para a sincronização automática por API.">
            <CredentialsForm networkId={n.id} fields={adapter.credentialFields} configured={!!cred} last4={cred?.last4 ?? ""} />
          </FormSection>
        )}
        {canWrite && (adapter.capabilities.api || adapter.capabilities.prices) && (
          <FormSection title="Sincronização" description={adapter.capabilities.prices ? "Atualiza os preços das ofertas Amazon que têm ASIN no campo ID externo." : "Busca conversões e comissões reportadas pela rede. Roda automaticamente todo dia às 4h (UTC) quando a rede está ativa."}>
            <SyncButtons networkId={n.id} canTest={!!adapter.testConnection} canSync />
          </FormSection>
        )}
        <FormSection title="Execuções recentes">
          {runs?.length ? (
            <ul className="divide-y divide-line rounded-md border border-line text-sm">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                  <span>{new Date(r.started_at).toLocaleString("pt-BR")} · {r.kind === "csv" ? "Importação CSV" : r.kind === "prices" ? "Preços" : "API"}</span>
                  <span className={r.ok === false ? "font-semibold" : "text-mute"}>{r.ok === false ? `Falhou: ${r.error ?? ""}` : r.ok ? `${r.inserted} novas · ${r.updated} atualizadas` : "Em andamento"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">Nenhuma sincronização ainda.</p>
          )}
        </FormSection>
        <FormSection title="Links associados" description="Até 20 ofertas que usam esta rede.">
          {links?.length ? (
            <ul className="divide-y divide-line rounded-md border border-line text-sm">
              {links.map((l) => (
                <li key={l.id} className="flex justify-between gap-2 px-4 py-2">
                  <Link href={`/admin/produtos/${l.product_id}`} className="hover:underline">{l.products?.product_translations.find((t) => t.locale === "pt-BR")?.name ?? "—"}</Link>
                  <span className="text-xs text-mute">{l.stores?.name} · {l.market} · {l.active ? "ativa" : "inativa"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">Nenhuma oferta usa esta rede.</p>
          )}
        </FormSection>
      </div>
    </>
  );
}
