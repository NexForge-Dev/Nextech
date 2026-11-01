import Link from "next/link";
import { Plus } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { storagePublicUrl } from "@/lib/supabase/env";
import { scheduleLabel } from "@/lib/data/admin/marketing";
import { PageHeader } from "@/components/admin/page-header";
import { ButtonLink, DataTable, EmptyPanel, StatusPill } from "@/components/admin/data-table";

export const metadata = { title: "Banners" };

export default async function BannersPage() {
  await pageGuard("marketing.write");
  const sb = await createServerSupabase();
  const { data } = await sb.from("banners").select("id, image_path, link_url, starts_at, ends_at, sort_order, active, banner_translations(locale, title), campaigns(name)").order("sort_order").limit(200);
  const rows = (data ?? []).map((b) => ({ ...b, title: b.banner_translations.find((t) => t.locale === "pt-BR")?.title ?? "Sem título", state: scheduleLabel(b.active, b.starts_at, b.ends_at), img: storagePublicUrl("banners", b.image_path) }));
  return (
    <>
      <PageHeader title="Banners" description="Exibidos em um carrossel discreto abaixo do hero da página inicial, apenas quando houver banners ativos." actions={<ButtonLink href="/admin/banners/novo"><Plus className="size-4" /> Novo banner</ButtonLink>} />
      <DataTable
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={1000}
        params={{}}
        basePath="/admin/banners"
        empty={<EmptyPanel title="Nenhum banner" action={<ButtonLink href="/admin/banners/novo">Novo banner</ButtonLink>} />}
        columns={[
          {
            key: "img",
            header: "",
            className: "w-28",
            cell: (r) => (
              <div className="h-10 w-24 overflow-hidden rounded bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.img && <img src={r.img} alt="" className="h-full w-full object-cover" />}
              </div>
            ),
          },
          { key: "title", header: "Título", cell: (r) => <Link href={`/admin/banners/${r.id}`} className="font-medium hover:underline">{r.title}</Link> },
          { key: "link", header: "Link", cell: (r) => <span className="font-mono text-xs text-mute">{r.link_url ?? "—"}</span> },
          { key: "campaign", header: "Campanha", cell: (r) => r.campaigns?.name ?? "—" },
          { key: "order", header: "Ordem", cell: (r) => <span className="tabular">{r.sort_order}</span> },
          { key: "state", header: "Situação", cell: (r) => <StatusPill active={r.state === "Ativa"} on="Ativo" off={r.state === "Inativa" ? "Inativo" : r.state === "Agendada" ? "Agendado" : "Encerrado"} /> },
        ]}
      />
    </>
  );
}
