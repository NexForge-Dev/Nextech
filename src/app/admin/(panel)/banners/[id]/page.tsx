import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { campaignOptions } from "@/lib/data/admin/marketing";
import { PageHeader } from "@/components/admin/page-header";
import { BannerForm, type BannerFormValue } from "@/components/admin/marketing-forms";

export const metadata = { title: "Editar banner" };

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard("marketing.write");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createServerSupabase();
  const [{ data: b }, campaigns] = await Promise.all([sb.from("banners").select("*, banner_translations(locale, title, subtitle)").eq("id", id).maybeSingle(), campaignOptions()]);
  if (!b) notFound();
  const translations: BannerFormValue["translations"] = {};
  for (const t of b.banner_translations) translations[t.locale as keyof typeof translations] = { title: t.title, subtitle: t.subtitle ?? "" };
  return (
    <>
      <PageHeader title={translations["pt-BR"]?.title ?? "Banner"} description="Editar banner" />
      <BannerForm campaigns={campaigns} initial={{ id: b.id, imagePath: b.image_path, mobileImagePath: b.mobile_image_path, linkUrl: b.link_url ?? "", startsAt: b.starts_at ?? "", endsAt: b.ends_at ?? "", sortOrder: b.sort_order, active: b.active, campaignId: b.campaign_id, translations }} />
    </>
  );
}
