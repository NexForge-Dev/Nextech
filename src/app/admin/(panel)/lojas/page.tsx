import Link from "next/link";
import { Plus } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { ButtonLink, DataTable, EmptyPanel, StatusPill } from "@/components/admin/data-table";

export const metadata = { title: "Lojas parceiras" };

export default async function StoresPage() {
  await pageGuard("stores.write");
  const sb = await createServerSupabase();
  const { data } = await sb.from("stores").select("id, name, slug, markets, active, created_at, price_display_policy, affiliate_networks(name, price_display_policy), store_domains(domain), affiliate_links(count)").order("name");
  const rows = (data ?? []).map((s) => ({
    ...s,
    links: (s.affiliate_links as unknown as { count: number }[])[0]?.count ?? 0,
    policy: (s.price_display_policy ?? s.affiliate_networks?.price_display_policy ?? "show") === "link_only" ? "Somente link" : "Mostra preço",
  }));
  return (
    <>
      <PageHeader title="Lojas parceiras" description="Lojas onde os produtos são vendidos. Cada loja define os domínios para onde o /go pode redirecionar." actions={<ButtonLink href="/admin/lojas/novo"><Plus className="size-4" /> Nova loja</ButtonLink>} />
      <DataTable
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={10000}
        params={{}}
        basePath="/admin/lojas"
        empty={<EmptyPanel title="Nenhuma loja parceira" text="Cadastre a primeira loja (por exemplo Amazon ou Mercado Livre) para poder adicionar ofertas aos produtos." action={<ButtonLink href="/admin/lojas/novo">Nova loja</ButtonLink>} />}
        columns={[
          { key: "name", header: "Loja", cell: (r) => <Link href={`/admin/lojas/${r.id}`} className="font-medium hover:underline">{r.name}</Link> },
          { key: "network", header: "Programa", cell: (r) => r.affiliate_networks?.name ?? <span className="text-mute">Manual</span> },
          { key: "markets", header: "Países", cell: (r) => <span className="font-mono text-xs">{r.markets.join(", ") || "—"}</span> },
          { key: "domains", header: "Domínios", cell: (r) => <span className="font-mono text-xs text-mute">{r.store_domains.map((d) => d.domain).join(", ") || "—"}</span> },
          { key: "policy", header: "Preço", cell: (r) => <span className="text-xs">{r.policy}</span> },
          { key: "links", header: "Links", cell: (r) => <span className="tabular">{r.links}</span> },
          { key: "created", header: "Cadastro", cell: (r) => <span className="tabular text-xs text-mute">{new Date(r.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span> },
          { key: "status", header: "Status", cell: (r) => <StatusPill active={r.active} /> },
        ]}
      />
    </>
  );
}
