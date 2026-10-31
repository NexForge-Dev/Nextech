import { pageGuard } from "@/lib/admin/guard";
import { getProductFormOptions } from "@/lib/data/admin/products";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";

export const metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  const ctx = await pageGuard("products.write");
  const opts = await getProductFormOptions();
  return (
    <>
      <PageHeader title="Novo produto" />
      <ProductForm
        {...opts}
        canAddDomain={ctx.permissions.has("stores.write")}
        initial={{
          slug: "",
          brandId: null,
          categoryId: "",
          tags: [],
          status: "draft",
          featured: false,
          sku: "",
          externalId: "",
          rating: "",
          ratingCount: "",
          ratingSource: "",
          specs: [],
          translations: { "pt-BR": { name: "", shortDescription: "", descriptionMd: "", specs: [] } },
          images: [],
          offers: [],
        }}
      />
    </>
  );
}
