"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteProduct, setFeatured, setProductStatus } from "@/actions/admin/products";
import { ConfirmButton, useAdminAction } from "./form";

export function ProductRowActions({ id, slug, name, status, featured, canDelete }: { id: string; slug: string; name: string; status: string; featured: boolean; canDelete: boolean }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  return (
    <div className="flex items-center justify-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`Ações de ${name}`} disabled={pending} className="grid size-8 cursor-pointer place-items-center rounded-md hover:bg-soft">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => router.push(`/admin/produtos/${id}`)}>Editar</DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/admin/produtos/${id}/desempenho`)}>Desempenho</DropdownMenuItem>
          {status === "published" && <DropdownMenuItem onClick={() => window.open(`/pt-br/produto/${slug}`, "_blank", "noopener")}>Ver na loja</DropdownMenuItem>}
          <DropdownMenuSeparator />
          {status === "published" ? (
            <DropdownMenuItem onClick={() => run(() => setProductStatus({ id, status: "draft" }), { success: "Produto desativado." })}>Desativar (rascunho)</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => run(() => setProductStatus({ id, status: "published" }), { success: "Produto publicado." })}>Ativar (publicar)</DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => run(() => setFeatured({ id, featured: !featured }), { success: featured ? "Removido da página inicial." : "Destacado na página inicial." })}>
            {featured ? "Remover destaque" : "Destacar na página inicial"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {canDelete && (
        <ConfirmButton
          label="Excluir"
          className="h-8 cursor-pointer rounded-md px-2 text-xs font-medium text-mute hover:bg-soft hover:text-black"
          title="Excluir produto?"
          description={`"${name}" e suas ofertas serão excluídos permanentemente. Prefira arquivar se quiser manter o histórico.`}
          confirmLabel="Excluir"
          onConfirm={() => run(() => deleteProduct({ id }), { success: "Produto excluído." })}
        />
      )}
      <Link href={`/admin/produtos/${id}`} className="sr-only">Editar {name}</Link>
    </div>
  );
}
