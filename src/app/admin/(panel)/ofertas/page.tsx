import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { scheduleLabel } from "@/lib/data/admin/marketing";
import { PageHeader } from "@/components/admin/page-header";
import { ButtonLink, DataTable, EmptyPanel, StatusPill } from "@/components/admin/data-table";

export const metadata = { title: "Ofertas" };

export default async function PromotionsPage() {
  await pageGuard("marketing.write");
  const sb = await createServerSupabase();
  const { data } = await sb.from("promotions").select("id, reason, starts_at, ends_at, publish_at, highlighted, active, products(product_translations(locale, name))").order("starts_at", { ascending: false }).limit(500);
  const rows = (data ?? []).map((p) => ({ ...p, name: p.products?.product_translations.find((t) => t.locale === "pt-BR")?.name ?? "—", state: scheduleLabel(p.active, p.starts_at, p.ends_at, p.publish_at) }));
  const fmt = (d: string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  return (
    <>
      <PageHeader title="Ofertas" description="Produtos exibidos na seção “Ofertas”. Somente descontos comprovados são mostrados; sem comprovação, aparece o motivo." actions={<ButtonLink href="/admin/ofertas/novo"><Plus className="size-4" /> Nova oferta</ButtonLink>} />
      <DataTable
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={1000}
        params={{}}
        basePath="/admin/ofertas"
        empty={<EmptyPanel title="Nenhuma oferta cadastrada" text="Selecione produtos para a seção de ofertas, com período de exibição." action={<ButtonLink href="/admin/ofertas/novo">Nova oferta</ButtonLink>} />}
        columns={[
          { key: "product", header: "Produto", cell: (r) => <Link href={`/admin/ofertas/${r.id}`} className="font-medium hover:underline">{r.name}{r.highlighted && <Star className="ml-1.5 inline size-3.5 fill-black" aria-label="Destaque" />}</Link> },
          { key: "reason", header: "Motivo", cell: (r) => r.reason ?? <span className="text-xs text-mute">Desconto comprovado</span> },
          { key: "period", header: "Período", cell: (r) => <span className="tabular text-xs">{fmt(r.starts_at)} → {fmt(r.ends_at)}</span> },
          { key: "state", header: "Situação", cell: (r) => <StatusPill active={r.state === "Ativa"} on={r.state} off={r.state} /> },
        ]}
      />
    </>
  );
}
