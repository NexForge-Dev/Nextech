"use client";
import { useRouter } from "next/navigation";
import { setFlagshipProduct } from "@/actions/admin/products";
import { inputCls, useAdminAction } from "./form";

/** Picks which highlighted product opens the home. From two highlighted products up, the top rotates. */
export function FlagshipPicker({ products, value, shownNames }: { products: { id: string; name: string }[]; value: string | null; shownNames: string[] }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  return (
    <section className="panel mb-4 p-5 md:flex md:items-center md:justify-between md:gap-8">
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <p className="text-sm font-semibold">Produto destaque da página inicial</p>
        <p className="mt-1 text-sm text-mute">{shownNames.length ? `${shownNames.length > 1 ? "Em carrossel no topo da loja" : "No topo da loja agora"}: ${shownNames.join(", ")}` : "Publique um produto para ele aparecer no topo da loja."}</p>
        <p className="mt-1 text-sm text-mute">Com 2 ou mais produtos destacados, o topo vira um carrossel. Aqui você escolhe qual aparece primeiro.</p>
      </div>
      <div className="mt-3 md:mt-0 md:w-96 md:shrink-0">
        <label htmlFor="flagship-product" className="sr-only">Produto destaque</label>
        <select
          id="flagship-product"
          className={`${inputCls} text-black`}
          disabled={pending}
          value={value ?? ""}
          onChange={(e) => {
            const id = e.target.value || null;
            run(() => setFlagshipProduct({ id }), { success: "Produto destaque atualizado.", onSuccess: () => router.refresh() });
          }}
        >
          <option value="">Automático (o destacado mais recente primeiro)</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
    </section>
  );
}
