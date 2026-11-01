import { pageGuard } from "@/lib/admin/guard";
import { ADAPTER_KEYS, getAdapter } from "@/lib/affiliates/registry";
import { PageHeader } from "@/components/admin/page-header";
import { NetworkForm } from "@/components/admin/network-forms";

export const metadata = { title: "Nova rede" };

export default async function NewNetworkPage() {
  await pageGuard("networks.write");
  const adapters = ADAPTER_KEYS.map((k) => ({ key: k, label: getAdapter(k).label, settingsFields: getAdapter(k).settingsFields }));
  return (
    <>
      <PageHeader title="Nova rede de afiliados" />
      <NetworkForm canWrite adapters={adapters} initial={{ key: "", adapter: "generic", name: "", subidParam: "", priceDisplayPolicy: "show", settings: {}, active: false }} />
    </>
  );
}
