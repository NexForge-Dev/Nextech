import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMarketOptions, getNetworkOptions } from "@/lib/data/admin/options";
import { PageHeader } from "@/components/admin/page-header";
import { StoreForm } from "@/components/admin/taxonomy-forms";

export const metadata = { title: "Editar loja" };

export default async function EditStorePage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard("stores.write");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createServerSupabase();
  const [{ data: s }, networks, markets] = await Promise.all([
    sb.from("stores").select("id, name, slug, logo_path, official_url, description, network_id, markets, price_display_policy, active, created_at, store_domains(domain)").eq("id", id).maybeSingle(),
    getNetworkOptions(),
    getMarketOptions(),
  ]);
  if (!s) notFound();
  return (
    <>
      <PageHeader title={s.name} description="Editar loja parceira" />
      <StoreForm
        networks={networks}
        markets={markets}
        initial={{
          id: s.id,
          name: s.name,
          slug: s.slug,
          logoPath: s.logo_path,
          officialUrl: s.official_url ?? "",
          description: s.description ?? "",
          networkId: s.network_id,
          markets: s.markets,
          priceDisplayPolicy: (s.price_display_policy as "show" | "link_only" | null) ?? "inherit",
          domains: s.store_domains.map((d) => d.domain),
          active: s.active,
          createdAt: s.created_at,
        }}
      />
    </>
  );
}
