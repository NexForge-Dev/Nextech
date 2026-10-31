"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { slugify } from "@/lib/domain/slug";
import { discountPercent } from "@/lib/domain/pricing";
import { toMinor } from "@/lib/domain/money";
import { saveProduct } from "@/actions/admin/products";
import { addStoreDomain } from "@/actions/admin/taxonomy";
import { btnPrimary, btnSecondary, Field, FormSection, inputCls, LocaleTabs, textareaCls, Toggle, useAdminAction, type LocaleCode } from "./form";
import { ImageUploader, type ImageItem } from "./image-uploader";

type Spec = { label: string; value: string };
type Translation = { name: string; shortDescription: string; descriptionMd: string; specs: Spec[] };
export type OfferValue = {
  id?: string;
  storeId: string;
  networkId: string | null;
  market: string;
  currency: string;
  originalUrl: string;
  affiliateUrl: string;
  price: string;
  previousPrice: string;
  previousVerified: boolean;
  previousEvidence: string;
  externalId: string;
  active: boolean;
  priceUpdatedAt?: string | null;
};
export type ProductFormValue = {
  id?: string;
  slug: string;
  brandId: string | null;
  categoryId: string;
  tags: string[];
  status: "draft" | "published" | "archived";
  featured: boolean;
  sku: string;
  externalId: string;
  rating: string;
  ratingCount: string;
  ratingSource: string;
  specs: Spec[];
  translations: Partial<Record<LocaleCode, Translation>>;
  images: ImageItem[];
  offers: OfferValue[];
};
type Store = { id: string; name: string; networkId: string | null; markets: string[] };
type Opt = { id: string; name: string };
type Market = { code: string; name: string; currency: string };

const emptyT: Translation = { name: "", shortDescription: "", descriptionMd: "", specs: [] };

function SpecsEditor({ value, onChange }: { value: Spec[]; onChange: (v: Spec[]) => void }) {
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="flex gap-2">
          <input aria-label="Característica" placeholder="Característica (ex.: Bateria)" className={inputCls} value={s.label} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input aria-label="Valor" placeholder="Valor (ex.: 30 horas)" className={inputCls} value={s.value} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          <button type="button" aria-label="Remover característica" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-md border border-line hover:bg-soft"><Trash2 className="size-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { label: "", value: "" }])} className={btnSecondary}><Plus className="size-4" /> Adicionar característica</button>
    </div>
  );
}

export function ProductForm({ initial, categories, brands, stores, markets, canAddDomain }: { initial: ProductFormValue; categories: Opt[]; brands: Opt[]; stores: Store[]; markets: Market[]; canAddDomain: boolean }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [v, setV] = useState(initial);
  const [tab, setTab] = useState<LocaleCode>("pt-BR");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [tagText, setTagText] = useState(initial.tags.join(", "));
  const t = v.translations[tab] ?? emptyT;
  const err = (k: string) => errors[k];

  const setT = (patch: Partial<Translation>) => {
    const translations = { ...v.translations, [tab]: { ...t, ...patch } };
    const slug = !slugTouched && tab === "pt-BR" && patch.name !== undefined ? slugify(patch.name) : v.slug;
    setV({ ...v, translations, slug });
  };
  const setOffer = (i: number, patch: Partial<OfferValue>) => setV({ ...v, offers: v.offers.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const tags = tagText.split(",").map((x) => slugify(x)).filter(Boolean);
    run(() => saveProduct({ ...v, tags }), {
      success: "Produto salvo.",
      onSuccess: (d) => {
        if (!v.id) router.push(`/admin/produtos/${d.id}`);
      },
      onError: (r) => setErrors(r.fieldErrors ?? {}),
    });
  }

  return (
    <form onSubmit={submit} className="max-w-6xl" noValidate>
      <FormSection title="Informações básicas" description="Nome e descrições por idioma. O português (Brasil) é obrigatório; os demais usam o português como reserva.">
        <LocaleTabs value={tab} onChange={setTab} filled={Object.fromEntries(Object.entries(v.translations).map(([k, x]) => [k, !!x?.name]))} />
        <Field label="Nome do produto" htmlFor="p-name" error={err(`translations.${tab}.name`)}>
          <input id="p-name" className={inputCls} value={t.name} maxLength={160} onChange={(e) => setT({ name: e.target.value })} />
        </Field>
        <Field label="Descrição curta" htmlFor="p-short" hint={`${t.shortDescription.length}/280`}>
          <textarea id="p-short" className={textareaCls} rows={2} maxLength={280} value={t.shortDescription} onChange={(e) => setT({ shortDescription: e.target.value })} />
        </Field>
        <Field label="Descrição completa" htmlFor="p-desc" hint="Aceita Markdown simples: **negrito**, listas, títulos (##) e links https.">
          <textarea id="p-desc" className={`${textareaCls} font-mono`} rows={8} maxLength={20000} value={t.descriptionMd} onChange={(e) => setT({ descriptionMd: e.target.value })} />
        </Field>
        <Field label={`Características técnicas (${tab})`} hint={tab === "pt-BR" ? "Se vazias em um idioma, a loja usa as características gerais abaixo." : undefined}>
          <SpecsEditor value={t.specs} onChange={(specs) => setT({ specs })} />
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Slug" htmlFor="p-slug" error={err("slug")} hint="Endereço do produto na loja.">
            <input id="p-slug" className={`${inputCls} font-mono`} value={v.slug} onChange={(e) => { setSlugTouched(true); setV({ ...v, slug: e.target.value }); }} />
          </Field>
          <Field label="Categoria" htmlFor="p-cat" error={err("categoryId")}>
            <select id="p-cat" className={inputCls} value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })}>
              <option value="">Selecione…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Marca" htmlFor="p-brand">
            <select id="p-brand" className={inputCls} value={v.brandId ?? ""} onChange={(e) => setV({ ...v, brandId: e.target.value || null })}>
              <option value="">Sem marca</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Tags" htmlFor="p-tags" error={Object.entries(errors).find(([k]) => k.startsWith("tags"))?.[1]} hint="Separadas por vírgula. Usadas na busca e em produtos relacionados.">
            <input id="p-tags" className={inputCls} value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="bluetooth, sem fio" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Imagens" description="A primeira imagem principal aparece nos cards e no topo da página do produto.">
        <Field label="Galeria" error={err("images")}>
          <ImageUploader bucket="products" value={v.images} onChange={(images) => setV({ ...v, images })} />
        </Field>
      </FormSection>

      <FormSection title="Ofertas e links de afiliados" description="Uma oferta por loja e país. O preço só aparece quando a política da loja permite; o desconto só aparece quando comprovado.">
        {v.offers.length === 0 && <p className="text-sm text-mute">Nenhuma oferta. Sem ofertas, o produto aparece como indisponível.</p>}
        {v.offers.map((o, i) => {
          const store = stores.find((s) => s.id === o.storeId);
          const current = toMinor(o.price, o.currency);
          const previous = toMinor(o.previousPrice, o.currency);
          const pct = current != null && previous != null ? discountPercent(current, previous) : 0;
          const hostError = [err(`offers.${i}.originalUrl`), err(`offers.${i}.affiliateUrl`)].flat().find((m) => m?.startsWith("Domínio"));
          const host = hostError?.match(/"([^"]+)"/)?.[1];
          return (
            <fieldset key={o.id ?? `new-${i}`} className="space-y-4 rounded-md border border-line p-4">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-semibold">Oferta {i + 1}{store ? ` · ${store.name}` : ""}</legend>
                <div className="flex items-center gap-3">
                  <Toggle checked={o.active} onChange={(active) => setOffer(i, { active })} label="Ativa" />
                  <button type="button" aria-label={`Remover oferta ${i + 1}`} onClick={() => setV({ ...v, offers: v.offers.filter((_, j) => j !== i) })} className="grid size-9 cursor-pointer place-items-center rounded-md border border-line hover:bg-soft"><Trash2 className="size-4" /></button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Loja parceira" htmlFor={`o-store-${i}`} error={err(`offers.${i}.storeId`)}>
                  <select id={`o-store-${i}`} className={inputCls} value={o.storeId} onChange={(e) => {
                    const s = stores.find((x) => x.id === e.target.value);
                    const market = s?.markets.includes(o.market) ? o.market : (s?.markets[0] ?? o.market);
                    setOffer(i, { storeId: e.target.value, networkId: s?.networkId ?? null, market, currency: markets.find((m) => m.code === market)?.currency ?? o.currency });
                  }}>
                    <option value="">Selecione…</option>
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="País" htmlFor={`o-market-${i}`} error={err(`offers.${i}.market`)}>
                  <select id={`o-market-${i}`} className={inputCls} value={o.market} onChange={(e) => setOffer(i, { market: e.target.value, currency: markets.find((m) => m.code === e.target.value)?.currency ?? o.currency })}>
                    {markets.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
                  </select>
                </Field>
                <Field label="Moeda" htmlFor={`o-cur-${i}`} error={err(`offers.${i}.currency`)}>
                  <input id={`o-cur-${i}`} className={`${inputCls} font-mono uppercase`} maxLength={3} value={o.currency} onChange={(e) => setOffer(i, { currency: e.target.value.toUpperCase() })} />
                </Field>
              </div>
              <Field label="Link original do produto" htmlFor={`o-url-${i}`} error={err(`offers.${i}.originalUrl`)}>
                <input id={`o-url-${i}`} className={inputCls} value={o.originalUrl} onChange={(e) => setOffer(i, { originalUrl: e.target.value })} placeholder="https://www.loja.com/produto" />
              </Field>
              <Field label="Link de afiliado" htmlFor={`o-aff-${i}`} error={err(`offers.${i}.affiliateUrl`)} hint="Se vazio, o /go usa o link original.">
                <input id={`o-aff-${i}`} className={inputCls} value={o.affiliateUrl} onChange={(e) => setOffer(i, { affiliateUrl: e.target.value })} placeholder="https://…" />
              </Field>
              {host && canAddDomain && store && (
                <button type="button" onClick={() => run(() => addStoreDomain({ storeId: store.id, domain: host }), { success: `Domínio ${host} adicionado à loja ${store.name}. Salve novamente.`, onSuccess: () => setErrors({}) })} className={btnSecondary}>
                  Adicionar domínio “{host}” à loja
                </button>
              )}
              <div className="grid gap-4 md:grid-cols-3">
                <Field label={`Preço atual (${o.currency})`} htmlFor={`o-price-${i}`} error={err(`offers.${i}.price`)} hint={o.priceUpdatedAt ? `Atualizado em ${new Date(o.priceUpdatedAt).toLocaleString("pt-BR")}` : "Deixe vazio se a loja não permite exibir preço."}>
                  <input id={`o-price-${i}`} inputMode="decimal" className={`${inputCls} tabular`} value={o.price} onChange={(e) => setOffer(i, { price: e.target.value })} placeholder="199,90" />
                </Field>
                <Field label="Preço anterior" htmlFor={`o-prev-${i}`} error={err(`offers.${i}.previousPrice`)}>
                  <input id={`o-prev-${i}`} inputMode="decimal" className={`${inputCls} tabular`} value={o.previousPrice} onChange={(e) => setOffer(i, { previousPrice: e.target.value })} />
                </Field>
                <Field label="ID externo / SKU na loja" htmlFor={`o-ext-${i}`}>
                  <input id={`o-ext-${i}`} className={`${inputCls} font-mono`} value={o.externalId} onChange={(e) => setOffer(i, { externalId: e.target.value })} />
                </Field>
              </div>
              {o.previousPrice && (
                <div className="space-y-3 rounded-md bg-soft p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-black" checked={o.previousVerified} onChange={(e) => setOffer(i, { previousVerified: e.target.checked })} />
                    Preço anterior verificado (tenho evidência)
                  </label>
                  {o.previousVerified && (
                    <Field label="Evidência" htmlFor={`o-ev-${i}`} error={err(`offers.${i}.previousEvidence`)}>
                      <input id={`o-ev-${i}`} className={inputCls} value={o.previousEvidence} onChange={(e) => setOffer(i, { previousEvidence: e.target.value })} placeholder="Link de histórico de preço ou nota" />
                    </Field>
                  )}
                  <p className="text-xs text-mute">
                    {o.previousVerified && pct > 0
                      ? `Desconto exibido na loja: -${pct}% (calculado automaticamente).`
                      : "O desconto não será exibido até o preço anterior ser comprovado (marcado como verificado ou registrado no histórico de preços)."}
                  </p>
                </div>
              )}
            </fieldset>
          );
        })}
        <button
          type="button"
          onClick={() => {
            const s = stores[0];
            const market = s?.markets[0] ?? markets[0]?.code ?? "BR";
            setV({ ...v, offers: [...v.offers, { storeId: s?.id ?? "", networkId: s?.networkId ?? null, market, currency: markets.find((m) => m.code === market)?.currency ?? "BRL", originalUrl: "", affiliateUrl: "", price: "", previousPrice: "", previousVerified: false, previousEvidence: "", externalId: "", active: true }] });
          }}
          className={btnSecondary}
          disabled={!stores.length}
        >
          <Plus className="size-4" /> {stores.length ? "Adicionar oferta" : "Cadastre uma loja parceira primeiro"}
        </button>
      </FormSection>

      <FormSection title="Informações adicionais" description="Avaliações só aparecem com a fonte informada e nunca para lojas que não permitem (ex.: Amazon).">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Avaliação (0–5)" htmlFor="p-rating" error={err("rating")}>
            <input id="p-rating" inputMode="decimal" className={inputCls} value={v.rating} onChange={(e) => setV({ ...v, rating: e.target.value })} />
          </Field>
          <Field label="Quantidade de avaliações" htmlFor="p-rcount" error={err("ratingCount")}>
            <input id="p-rcount" inputMode="numeric" className={inputCls} value={v.ratingCount} onChange={(e) => setV({ ...v, ratingCount: e.target.value })} />
          </Field>
          <Field label="Fonte da avaliação" htmlFor="p-rsource" error={err("ratingSource")}>
            <input id="p-rsource" className={inputCls} value={v.ratingSource} onChange={(e) => setV({ ...v, ratingSource: e.target.value })} placeholder="Mercado Livre" />
          </Field>
          <Field label="SKU" htmlFor="p-sku" error={err("sku")}>
            <input id="p-sku" className={`${inputCls} font-mono`} value={v.sku} onChange={(e) => setV({ ...v, sku: e.target.value })} />
          </Field>
          <Field label="Identificador externo" htmlFor="p-ext">
            <input id="p-ext" className={`${inputCls} font-mono`} value={v.externalId} onChange={(e) => setV({ ...v, externalId: e.target.value })} />
          </Field>
        </div>
        <Field label="Características gerais (todas as línguas)">
          <SpecsEditor value={v.specs} onChange={(specs) => setV({ ...v, specs })} />
        </Field>
      </FormSection>

      <FormSection title="Publicação">
        <Field label="Status" htmlFor="p-status">
          <select id="p-status" className={`${inputCls} max-w-xs`} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as ProductFormValue["status"] })}>
            <option value="draft">Rascunho</option>
            <option value="published">Publicado</option>
            <option value="archived">Arquivado</option>
          </select>
        </Field>
        <Toggle checked={v.featured} onChange={(featured) => setV({ ...v, featured })} label="Destacar na página inicial (Seleção NEXTECH)" />
      </FormSection>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-white px-4 py-4 md:-mx-8 md:px-8">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Salvando…" : "Salvar produto"}</button>
        <button type="button" onClick={() => router.push("/admin/produtos")} className={btnSecondary}>Voltar</button>
        {Object.keys(errors).length > 0 && <p role="alert" className="self-center text-sm font-medium">⚠ Há {Object.keys(errors).length} campo(s) com erro.</p>}
      </div>
    </form>
  );
}
