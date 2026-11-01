import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { ConversionImport } from "@/components/admin/network-forms";

export const metadata = { title: "Importar relatório" };

export default async function ImportConversionsPage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard("conversions.import");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createServerSupabase();
  const { data: n } = await sb.from("affiliate_networks").select("id, name, adapter").eq("id", id).maybeSingle();
  if (!n) notFound();
  return (
    <>
      <PageHeader
        title={`Importar relatório — ${n.name}`}
        description={n.adapter === "amazon" ? "Envie o relatório “Fee-Earnings” (CSV) exportado no Associates Central." : "Envie o relatório de transações/ações exportado no painel da rede e indique as colunas."}
      />
      <ConversionImport networkId={n.id} adapter={n.adapter} />
    </>
  );
}
