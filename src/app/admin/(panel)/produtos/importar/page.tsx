import { pageGuard } from "@/lib/admin/guard";
import { PRODUCT_CSV_COLUMNS } from "@/lib/domain/csv";
import { buildProductJsonPrompt } from "@/lib/domain/product-json";
import { getProductJsonCatalog } from "@/lib/data/admin/products";
import { PageHeader } from "@/components/admin/page-header";
import { CsvImport } from "@/components/admin/csv-import";
import { JsonImport } from "@/components/admin/json-import";

export const metadata = { title: "Importar produtos" };

export default async function ImportProductsPage() {
  await pageGuard("products.import");
  const prompt = buildProductJsonPrompt(await getProductJsonCatalog());
  return (
    <>
      <PageHeader title="Importar por JSON" description="Copie o modelo, peça ao ChatGPT para preencher e cole a resposta aqui. Produtos novos entram sem imagens." />
      <JsonImport prompt={prompt} />
      <div className="mt-10">
        <PageHeader title="Importar por CSV" description="Cria ou atualiza produtos e ofertas de afiliados em lote: com afiliados desligados eles não aparecem na loja. Para venda própria, use o JSON acima. Preços importados ficam marcados com a fonte “importação”." />
        <CsvImport columns={PRODUCT_CSV_COLUMNS} />
      </div>
    </>
  );
}
