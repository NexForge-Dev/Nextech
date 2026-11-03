"use client";
import { useRouter } from "next/navigation";
import { setFlagshipProduct } from "@/actions/admin/products";
import { inputCls, useAdminAction } from "./form";

/** Picks the product at the top of the home. "Automático" shows the most recent highlighted product. */
export function FlagshipPicker({ products, value, shownName }: { products: { id: string; name: string }[]; value: string | null; shownName: string | null }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  return (
    <section className="mb-6 rounded-md bg-black p-5 text-white md:flex md:items-center md:justify-between md:gap-8">
      <div>
        <p className="text-sm font-semibold">Produto destaque da página inicial</p>
        <p className="mt-1 text-sm text-white/70">{shownName ? `No topo da loja agora: ${shownName}` : "Publique um produto para ele aparecer no topo da loja."}</p>
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
          <option value="">Automático (o destacado mais recente)</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
    </section>
  );
}
