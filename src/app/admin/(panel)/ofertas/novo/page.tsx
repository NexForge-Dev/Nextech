import { pageGuard } from "@/lib/admin/guard";
import { productOptions } from "@/lib/data/admin/marketing";
import { PageHeader } from "@/components/admin/page-header";
import { PromotionForm } from "@/components/admin/marketing-forms";

export const metadata = { title: "Nova oferta" };

export default async function NewPromotionPage() {
  await pageGuard("marketing.write");
  const products = await productOptions();
  return (
    <>
      <PageHeader title="Nova oferta" />
      <PromotionForm products={products} initial={{ productId: "", reason: "", startsAt: "", endsAt: "", publishAt: "", highlighted: false, active: true }} />
    </>
  );
}
