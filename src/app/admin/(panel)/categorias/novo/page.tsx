import { pageGuard } from "@/lib/admin/guard";
import { PageHeader } from "@/components/admin/page-header";
import { CategoryForm } from "@/components/admin/taxonomy-forms";

export const metadata = { title: "Nova categoria" };

export default async function NewCategoryPage() {
  await pageGuard("categories.write");
  return (
    <>
      <PageHeader title="Nova categoria" />
      <CategoryForm initial={{ slug: "", icon: "Package", imagePath: null, sortOrder: 1000, active: true, translations: { "pt-BR": { name: "", description: "" } } }} />
    </>
  );
}
