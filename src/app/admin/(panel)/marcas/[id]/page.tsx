import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { BrandForm } from "@/components/admin/taxonomy-forms";

export const metadata = { title: "Editar marca" };

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard("brands.write");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createServerSupabase();
  const { data: b } = await sb.from("brands").select("id, name, slug, logo_path, active").eq("id", id).maybeSingle();
  if (!b) notFound();
  return (
    <>
      <PageHeader title={b.name} description="Editar marca" />
      <BrandForm initial={{ id: b.id, name: b.name, slug: b.slug, logoPath: b.logo_path, active: b.active }} />
    </>
  );
}
