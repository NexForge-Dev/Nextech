import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { bannerOptions, productOptions } from "@/lib/data/admin/marketing";
import { formatCurrencyAmounts, groupByCurrency } from "@/lib/domain/aggregates";
import { PageHeader } from "@/components/admin/page-header";
import { CampaignForm, type CampaignFormValue } from "@/components/admin/marketing-forms";

export const metadata = { title: "Campanha" };

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await pageGuard("marketing.write");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createServerSupabase();
  const canSeeResults = ctx.permissions.has("analytics.read");
  const [{ data: c }, products, banners, clicks, conversions] = await Promise.all([
    sb.from("campaigns").select("*, campaign_translations(locale, title, description), campaign_products(product_id, sort_order), campaign_banners(banner_id)").eq("id", id).maybeSingle(),
    productOptions(),
    bannerOptions(),
    canSeeResults ? sb.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("is_bot", false) : Promise.resolve({ count: null }),
    canSeeResults ? sb.from("affiliate_conversions").select("id, affiliate_commissions(amount_minor, currency, status)").eq("campaign_id", id) : Promise.resolve({ data: [] }),
  ]);
  if (!c) notFound();
  const translations: CampaignFormValue["translations"] = {};
  for (const t of c.campaign_translations) translations[t.locale as keyof typeof translations] = { title: t.title, description: t.description ?? "" };
  const convRows = ((conversions as { data: { affiliate_commissions: { amount_minor: number; currency: string; status: string }[] }[] | null }).data ?? []);
  const g = groupByCurrency(convRows.flatMap((r) => r.affiliate_commissions.map((x) => ({ amountMinor: x.amount_minor, currency: x.currency, status: x.status }))));
  return (
    <>
      <PageHeader
        title={c.name}
        description="Campanha"
        actions={
          <a href={`/pt-br/campanha/${c.slug}`} target="_blank" rel="noopener" className="btn btn-secondary">
            <ExternalLink className="size-4" /> Página pública
          </a>
        }
      />
      {canSeeResults && (
        <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Cliques atribuídos", String((clicks as { count: number | null }).count ?? 0)],
            ["Conversões reportadas", String(convRows.length)],
            ["Comissões estimadas", formatCurrencyAmounts(g.pending, "pt-BR")],
            ["Comissões confirmadas", formatCurrencyAmounts(g.confirmed, "pt-BR")],
          ].map(([l, v]) => (
            <div key={l} className="panel p-4">
              <p className="text-xs text-mute">{l}</p>
              <p className="tabular mt-1 text-lg font-semibold">{v}</p>
            </div>
          ))}
        </div>
      )}
      <CampaignForm
        products={products}
        banners={banners}
        initial={{
          id: c.id,
          slug: c.slug,
          name: c.name,
          startsAt: c.starts_at ?? "",
          endsAt: c.ends_at ?? "",
          status: c.status as CampaignFormValue["status"],
          productIds: [...c.campaign_products].sort((a, b) => a.sort_order - b.sort_order).map((p) => p.product_id),
          bannerIds: c.campaign_banners.map((b) => b.banner_id),
          translations,
        }}
      />
    </>
  );
}
