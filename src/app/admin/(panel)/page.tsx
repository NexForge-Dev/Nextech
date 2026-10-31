import { pageGuard } from "@/lib/admin/guard";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Visão geral" };

export default async function AdminHome() {
  await pageGuard();
  return <PageHeader title="Visão geral" description="Indicadores da operação." />;
}
