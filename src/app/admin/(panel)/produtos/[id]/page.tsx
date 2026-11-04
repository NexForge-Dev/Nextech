import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartLine, ExternalLink } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { getProductForEdit, getProductFormOptions } from "@/lib/data/admin/products";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";

export const metadata = { title: "Editar produto" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await pageGuard("products.write");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [product, opts] = await Promise.all([getProductForEdit(id), getProductFormOptions()]);
  if (!product) notFound();
  return (
    <>
      <PageHeader
        title={product.translations["pt-BR"]?.name ?? product.slug}
        description={product.status === "published" ? "Publicado" : product.status === "draft" ? "Rascunho" : "Arquivado"}
        actions={
          <>
            <Link href={`/admin/produtos/${id}/desempenho`} className="btn btn-secondary"><ChartLine className="size-4" /> Desempenho</Link>
            {product.status === "published" && (
              <a href={`/pt-br/produto/${product.slug}`} target="_blank" rel="noopener" className="btn btn-secondary"><ExternalLink className="size-4" /> Ver na loja</a>
            )}
          </>
        }
      />
      <ProductForm {...opts} canAddDomain={ctx.permissions.has("stores.write")} initial={product} />
    </>
  );
}
