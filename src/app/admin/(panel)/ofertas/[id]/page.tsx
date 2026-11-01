import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { productOptions } from "@/lib/data/admin/marketing";
import { PageHeader } from "@/components/admin/page-header";
import { PromotionForm } from "@/components/admin/marketing-forms";

export const metadata = { title: "Editar oferta" };

export default async function EditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard("marketing.write");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createServerSupabase();
  const [{ data: p }, products] = await Promise.all([sb.from("promotions").select("*").eq("id", id).maybeSingle(), productOptions()]);
  if (!p) notFound();
  return (
    <>
      <PageHeader title="Editar oferta" />
      <PromotionForm products={products} initial={{ id: p.id, productId: p.product_id, reason: p.reason ?? "", startsAt: p.starts_at, endsAt: p.ends_at, publishAt: p.publish_at ?? "", highlighted: p.highlighted, active: p.active }} />
    </>
  );
}
