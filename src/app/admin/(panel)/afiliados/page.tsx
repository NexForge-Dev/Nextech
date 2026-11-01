import Link from "next/link";
import { Plus } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getAdapter } from "@/lib/affiliates/registry";
import { PageHeader } from "@/components/admin/page-header";
import { ButtonLink, DataTable, EmptyPanel, StatusPill } from "@/components/admin/data-table";

export const metadata = { title: "Redes de afiliados" };

export default async function NetworksPage() {
  const ctx = await pageGuard();
  if (!ctx.permissions.has("networks.read") && !ctx.permissions.has("networks.write")) await pageGuard("networks.read");
  const sb = await createServerSupabase();
  const [{ data }, { data: creds }, { data: runs }] = await Promise.all([
    sb.from("affiliate_networks").select("id, key, name, adapter, active, price_display_policy, subid_param, stores(count), affiliate_links(count)").order("name"),
    createServiceSupabase().from("network_credentials").select("network_id"),
    sb.from("network_sync_runs").select("network_id, started_at, ok").order("started_at", { ascending: false }).limit(200),
  ]);
  const configured = new Set((creds ?? []).map((c) => c.network_id));
  const lastRun = new Map<string, { started_at: string; ok: boolean | null }>();
  for (const r of runs ?? []) if (!lastRun.has(r.network_id)) lastRun.set(r.network_id, r);
  const rows = (data ?? []).map((n) => ({
    ...n,
    adapterLabel: getAdapter(n.adapter).label,
    needsCreds: getAdapter(n.adapter).credentialFields.length > 0,
    stores: (n.stores as unknown as { count: number }[])[0]?.count ?? 0,
    links: (n.affiliate_links as unknown as { count: number }[])[0]?.count ?? 0,
  }));
  return (
    <>
      <PageHeader
        title="Redes de afiliados"
        description="Programas e integrações. Cada rede tem seu próprio adaptador — as APIs não são iguais."
        actions={
          <>
            <ButtonLink href="/admin/afiliados/conversoes" variant="secondary">Conversões e comissões</ButtonLink>
            {ctx.permissions.has("networks.write") && <ButtonLink href="/admin/afiliados/nova"><Plus className="size-4" /> Nova rede</ButtonLink>}
          </>
        }
      />
      <DataTable
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={1000}
        params={{}}
        basePath="/admin/afiliados"
        empty={<EmptyPanel title="Nenhuma rede" />}
        columns={[
          { key: "name", header: "Rede", cell: (r) => <Link href={`/admin/afiliados/${r.id}`} className="font-medium hover:underline">{r.name}</Link> },
          { key: "adapter", header: "Integração", cell: (r) => <span className="text-xs">{r.adapterLabel}</span> },
          { key: "creds", header: "Credenciais", cell: (r) => (!r.needsCreds ? <span className="text-xs text-mute">Não usa</span> : <StatusPill active={configured.has(r.id)} on="Configuradas" off="Pendentes" />) },
          { key: "policy", header: "Preço", cell: (r) => <span className="text-xs">{r.price_display_policy === "link_only" ? "Somente link" : "Mostra preço"}</span> },
          { key: "usage", header: "Lojas / links", cell: (r) => <span className="tabular">{r.stores} / {r.links}</span> },
          { key: "sync", header: "Última sincronização", cell: (r) => { const l = lastRun.get(r.id); return l ? <span className="text-xs">{new Date(l.started_at).toLocaleString("pt-BR")} {l.ok === false ? "· falhou ⚠" : l.ok ? "· ok" : "· em andamento"}</span> : <span className="text-xs text-mute">—</span>; } },
          { key: "status", header: "Status", cell: (r) => <StatusPill active={r.active} on="Ativa" off="Inativa" /> },
        ]}
      />
    </>
  );
}
