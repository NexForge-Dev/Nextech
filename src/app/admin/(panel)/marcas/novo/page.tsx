import { pageGuard } from "@/lib/admin/guard";
import { PageHeader } from "@/components/admin/page-header";
import { BrandForm } from "@/components/admin/taxonomy-forms";

export const metadata = { title: "Nova marca" };

export default async function NewBrandPage() {
  await pageGuard("brands.write");
  return (
    <>
      <PageHeader title="Nova marca" />
      <BrandForm initial={{ name: "", slug: "", logoPath: null, active: true }} />
    </>
  );
}
