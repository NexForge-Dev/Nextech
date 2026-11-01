import { pageGuard } from "@/lib/admin/guard";
import { getMarketOptions, getNetworkOptions } from "@/lib/data/admin/options";
import { PageHeader } from "@/components/admin/page-header";
import { StoreForm } from "@/components/admin/taxonomy-forms";

export const metadata = { title: "Nova loja" };

export default async function NewStorePage() {
  await pageGuard("stores.write");
  const [networks, markets] = await Promise.all([getNetworkOptions(), getMarketOptions()]);
  return (
    <>
      <PageHeader title="Nova loja parceira" />
      <StoreForm networks={networks} markets={markets} initial={{ name: "", slug: "", logoPath: null, officialUrl: "", description: "", networkId: null, markets: ["BR"], priceDisplayPolicy: "inherit", domains: [], active: true }} />
    </>
  );
}
