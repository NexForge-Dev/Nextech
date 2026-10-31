import { pageGuard } from "@/lib/admin/guard";
import { bannerOptions, productOptions } from "@/lib/data/admin/marketing";
import { PageHeader } from "@/components/admin/page-header";
import { CampaignForm } from "@/components/admin/marketing-forms";

export const metadata = { title: "Nova campanha" };

export default async function NewCampaignPage() {
  await pageGuard("marketing.write");
  const [products, banners] = await Promise.all([productOptions(), bannerOptions()]);
  return (
    <>
      <PageHeader title="Nova campanha" />
      <CampaignForm products={products} banners={banners} initial={{ slug: "", name: "", startsAt: "", endsAt: "", status: "draft", productIds: [], bannerIds: [], translations: { "pt-BR": { title: "", description: "" } } }} />
    </>
  );
}
