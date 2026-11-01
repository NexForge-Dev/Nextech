import { pageGuard } from "@/lib/admin/guard";
import { PRODUCT_CSV_COLUMNS } from "@/lib/domain/csv";
import { PageHeader } from "@/components/admin/page-header";
import { CsvImport } from "@/components/admin/csv-import";

export const metadata = { title: "Importar produtos" };

export default async function ImportProductsPage() {
  await pageGuard("products.import");
  return (
    <>
      <PageHeader title="Importar produtos (CSV)" description="Cria ou atualiza produtos e ofertas em lote. Preços importados ficam marcados com a fonte “importação”." />
      <CsvImport columns={PRODUCT_CSV_COLUMNS} />
    </>
  );
}
