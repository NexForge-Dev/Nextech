import Link from "next/link";
import { Plus } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { campaignStatusAt } from "@/lib/admin/schemas/marketing";
import { PageHeader } from "@/components/admin/page-header";
import { ButtonLink, DataTable, EmptyPanel, StatusPill } from "@/components/admin/data-table";

export const metadata = { title: "Campanhas" };

const LABEL = { draft: "Rascunho", scheduled: "Agendada", active: "Ativa", ended: "Encerrada" } as const;

export default async function CampaignsPage() {
  await pageGuard("marketing.write");
  const sb = await createServerSupabase();
  const [{ data }, { data: clicks }] = await Promise.all([
    sb.from("campaigns").select("id, slug, name, status, starts_at, ends_at, campaign_products(count)").order("created_at", { ascending: false }),
    sb.from("affiliate_clicks").select("campaign_id").not("campaign_id", "is", null).eq("is_bot", false).limit(100000),
  ]);
  const clickCount = new Map<string, number>();
  for (const c of clicks ?? []) if (c.campaign_id) clickCount.set(c.campaign_id, (clickCount.get(c.campaign_id) ?? 0) + 1);
  const now = new Date();
  const rows = (data ?? []).map((c) => ({ ...c, effective: campaignStatusAt(c.status, c.starts_at, c.ends_at, now), products: (c.campaign_products as unknown as { count: number }[])[0]?.count ?? 0 }));
  return (
    <>
      <PageHeader title="Campanhas" description="Ações comerciais com página própria, produtos e banners. Cliques vindos da campanha são atribuídos a ela." actions={<ButtonLink href="/admin/campanhas/novo"><Plus className="size-4" /> Nova campanha</ButtonLink>} />
      <DataTable
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={1000}
        params={{}}
        basePath="/admin/campanhas"
        empty={<EmptyPanel title="Nenhuma campanha" action={<ButtonLink href="/admin/campanhas/novo">Nova campanha</ButtonLink>} />}
        columns={[
          { key: "name", header: "Campanha", cell: (r) => <Link href={`/admin/campanhas/${r.id}`} className="font-medium hover:underline">{r.name}</Link> },
          { key: "slug", header: "Slug", cell: (r) => <span className="font-mono text-xs text-mute">{r.slug}</span> },
          { key: "period", header: "Período", cell: (r) => <span className="tabular text-xs">{r.starts_at ? new Date(r.starts_at).toLocaleDateString("pt-BR") : "—"} → {r.ends_at ? new Date(r.ends_at).toLocaleDateString("pt-BR") : "—"}</span> },
          { key: "products", header: "Produtos", cell: (r) => <span className="tabular">{r.products}</span> },
          { key: "clicks", header: "Cliques", cell: (r) => <span className="tabular">{clickCount.get(r.id) ?? 0}</span> },
          { key: "status", header: "Situação", cell: (r) => <StatusPill active={r.effective === "active"} on={LABEL[r.effective]} off={LABEL[r.effective]} /> },
        ]}
      />
    </>
  );
}
