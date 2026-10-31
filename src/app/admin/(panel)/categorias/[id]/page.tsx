import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { CategoryForm, type CategoryFormValue } from "@/components/admin/taxonomy-forms";

export const metadata = { title: "Editar categoria" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard("categories.write");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createServerSupabase();
  const { data: c } = await sb.from("categories").select("id, slug, icon, image_path, sort_order, active, category_translations(locale, name, description)").eq("id", id).maybeSingle();
  if (!c) notFound();
  const translations: CategoryFormValue["translations"] = {};
  for (const t of c.category_translations) translations[t.locale as keyof typeof translations] = { name: t.name, description: t.description ?? "" };
  return (
    <>
      <PageHeader title={translations["pt-BR"]?.name ?? c.slug} description="Editar categoria" />
      <CategoryForm initial={{ id: c.id, slug: c.slug, icon: c.icon, imagePath: c.image_path, sortOrder: c.sort_order, active: c.active, translations }} />
    </>
  );
}
