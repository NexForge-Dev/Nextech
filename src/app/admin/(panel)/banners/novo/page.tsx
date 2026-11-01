import { pageGuard } from "@/lib/admin/guard";
import { campaignOptions } from "@/lib/data/admin/marketing";
import { PageHeader } from "@/components/admin/page-header";
import { BannerForm } from "@/components/admin/marketing-forms";

export const metadata = { title: "Novo banner" };

export default async function NewBannerPage() {
  await pageGuard("marketing.write");
  const campaigns = await campaignOptions();
  return (
    <>
      <PageHeader title="Novo banner" />
      <BannerForm campaigns={campaigns} initial={{ imagePath: "", mobileImagePath: null, linkUrl: "", startsAt: "", endsAt: "", sortOrder: 0, active: false, campaignId: null, translations: { "pt-BR": { title: "", subtitle: "" } } }} />
    </>
  );
}
