"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/domain/slug";
import { deleteBanner, deleteCampaign, deletePromotion, saveBanner, saveCampaign, savePromotion } from "@/actions/admin/marketing";
import { BannerCarousel } from "@/components/store/banner-carousel";
import { btnPrimary, btnSecondary, ConfirmButton, Field, FormSection, inputCls, LocaleTabs, textareaCls, Toggle, useAdminAction, type LocaleCode } from "./form";
import { ImageUploader } from "./image-uploader";

type Opt = { id: string; name: string };
type Errors = Record<string, string[]>;

/** ISO → value for <input type="datetime-local"> in the admin's own timezone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");

function ProductPicker({ products, value, onChange, id }: { products: Opt[]; value: string; onChange: (v: string) => void; id: string }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? products.filter((p) => p.name.toLowerCase().includes(t)) : products).slice(0, 200);
  }, [q, products]);
  return (
    <div className="space-y-2">
      <input aria-label="Filtrar produtos" className={inputCls} placeholder="Filtrar produtos…" value={q} onChange={(e) => setQ(e.target.value)} />
      <select id={id} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} size={Math.min(8, Math.max(3, list.length + 1))}>
        <option value="">Selecione…</option>
        {value && !list.some((p) => p.id === value) && <option value={value}>{products.find((p) => p.id === value)?.name ?? "Selecionado"}</option>}
        {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );
}

// ------------------------------------------------------------------ promotion
export type PromotionFormValue = { id?: string; productId: string; reason: string; startsAt: string; endsAt: string; publishAt: string; highlighted: boolean; active: boolean };

export function PromotionForm({ initial, products }: { initial: PromotionFormValue; products: Opt[] }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [v, setV] = useState({ ...initial, startsAt: toLocalInput(initial.startsAt), endsAt: toLocalInput(initial.endsAt), publishAt: toLocalInput(initial.publishAt) });
  const [errors, setErrors] = useState<Errors>({});
  return (
    <form
      className="max-w-5xl"
      onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        run(() => savePromotion({ ...v, startsAt: toIso(v.startsAt), endsAt: toIso(v.endsAt), publishAt: toIso(v.publishAt), linkId: null }), { success: "Oferta salva.", onSuccess: () => router.push("/admin/ofertas"), onError: (r) => setErrors(r.fieldErrors ?? {}) });
      }}
    >
      <FormSection title="Produto" description="A seção “Ofertas” mostra o desconto comprovado do produto. Sem desconto comprovado, informe o motivo — a NEXTECH nunca inventa descontos.">
        <Field label="Produto" htmlFor="pr-product" error={errors.productId}>
          <ProductPicker id="pr-product" products={products} value={v.productId} onChange={(productId) => setV({ ...v, productId })} />
        </Field>
        <Field label="Motivo da oferta" htmlFor="pr-reason" error={errors.reason} hint="Ex.: “Black Friday na Loja X”. Exibido quando não há desconto comprovado.">
          <input id="pr-reason" className={inputCls} maxLength={160} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />
        </Field>
      </FormSection>
      <FormSection title="Período e publicação">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Início" htmlFor="pr-start" error={errors.startsAt}>
            <input id="pr-start" type="datetime-local" className={inputCls} value={v.startsAt} onChange={(e) => setV({ ...v, startsAt: e.target.value })} />
          </Field>
          <Field label="Fim" htmlFor="pr-end" error={errors.endsAt}>
            <input id="pr-end" type="datetime-local" className={inputCls} value={v.endsAt} onChange={(e) => setV({ ...v, endsAt: e.target.value })} />
          </Field>
          <Field label="Publicar a partir de (opcional)" htmlFor="pr-pub" error={errors.publishAt}>
            <input id="pr-pub" type="datetime-local" className={inputCls} value={v.publishAt} onChange={(e) => setV({ ...v, publishAt: e.target.value })} />
          </Field>
        </div>
        <Toggle checked={v.highlighted} onChange={(highlighted) => setV({ ...v, highlighted })} label="Destaque (aparece primeiro)" />
        <Toggle checked={v.active} onChange={(active) => setV({ ...v, active })} label="Oferta ativa" />
      </FormSection>
      <div className="flex flex-wrap gap-2 pt-4">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Salvando…" : "Salvar oferta"}</button>
        <button type="button" onClick={() => router.push("/admin/ofertas")} className={btnSecondary}>Cancelar</button>
        {v.id && <ConfirmButton label="Remover oferta" title="Remover oferta?" description="O produto deixa de aparecer na seção de ofertas." confirmLabel="Remover" onConfirm={() => run(() => deletePromotion({ id: v.id }), { success: "Oferta removida.", onSuccess: () => router.push("/admin/ofertas") })} />}
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ banner
export type BannerFormValue = {
  id?: string;
  imagePath: string;
  mobileImagePath: string | null;
  linkUrl: string;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  active: boolean;
  campaignId: string | null;
  translations: Partial<Record<LocaleCode, { title: string; subtitle: string }>>;
};

export function BannerForm({ initial, campaigns }: { initial: BannerFormValue; campaigns: Opt[] }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [v, setV] = useState({ ...initial, startsAt: toLocalInput(initial.startsAt), endsAt: toLocalInput(initial.endsAt) });
  const [tab, setTab] = useState<LocaleCode>("pt-BR");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [errors, setErrors] = useState<Errors>({});
  const t = v.translations[tab] ?? { title: "", subtitle: "" };
  const preview = [{ id: "preview", title: v.translations[tab]?.title || v.translations["pt-BR"]?.title || "Título do banner", subtitle: v.translations[tab]?.subtitle || null, imagePath: v.imagePath, mobileImagePath: v.mobileImagePath, linkUrl: null }];
  const submit = (publish: boolean) => {
    setErrors({});
    run(() => saveBanner({ ...v, active: publish ? true : v.active, startsAt: toIso(v.startsAt), endsAt: toIso(v.endsAt) }), { success: publish ? "Banner publicado." : "Banner salvo.", onSuccess: () => router.push("/admin/banners"), onError: (r) => setErrors(r.fieldErrors ?? {}) });
  };
  return (
    <div className="max-w-6xl">
      <div role="tablist" className="mb-6 flex gap-1 border-b border-line">
        {(["edit", "preview"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`-mb-px cursor-pointer border-b-2 px-4 py-2 text-sm ${view === k ? "border-black font-medium" : "border-transparent text-mute"}`}>
            {k === "edit" ? "Editar" : "Pré-visualizar"}
          </button>
        ))}
      </div>
      {view === "preview" ? (
        <div className="space-y-8">
          {!v.imagePath && <p className="text-sm text-mute">Envie a imagem para visualizar o banner.</p>}
          {v.imagePath && (
            <>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-mute">Desktop (1280 px)</p>
                <div className="overflow-x-auto panel p-4">
                  <div className="w-[1248px]">
                    <BannerCarousel banners={preview} labels={{ previous: "Anterior", next: "Próximo" }} frame="desktop" />
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-mute">Celular (375 px)</p>
                <div className="w-[375px] panel p-3">
                  <BannerCarousel banners={preview} labels={{ previous: "Anterior", next: "Próximo" }} frame="mobile" />
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit(false); }}>
          <FormSection title="Textos">
            <LocaleTabs value={tab} onChange={setTab} filled={Object.fromEntries(Object.entries(v.translations).map(([k, x]) => [k, !!x?.title]))} />
            <Field label="Título" htmlFor="b-title" error={errors[`translations.${tab}.title`]}>
              <input id="b-title" className={inputCls} maxLength={120} value={t.title} onChange={(e) => setV({ ...v, translations: { ...v.translations, [tab]: { ...t, title: e.target.value } } })} />
            </Field>
            <Field label="Subtítulo" htmlFor="b-sub">
              <textarea id="b-sub" className={textareaCls} rows={2} maxLength={240} value={t.subtitle} onChange={(e) => setV({ ...v, translations: { ...v.translations, [tab]: { ...t, subtitle: e.target.value } } })} />
            </Field>
          </FormSection>
          <FormSection title="Imagens" description="Desktop 21:8 (ex.: 2100×800). Celular 4:5 (ex.: 1080×1350) — opcional.">
            <Field label="Imagem (desktop)" error={errors.imagePath}>
              <ImageUploader bucket="banners" multiple={false} label="Enviar imagem" value={v.imagePath ? [{ path: v.imagePath, alt: "", isMain: true }] : []} onChange={(imgs) => setV({ ...v, imagePath: imgs[0]?.path ?? "" })} />
            </Field>
            <Field label="Imagem (celular)">
              <ImageUploader bucket="banners" multiple={false} label="Enviar imagem para celular" value={v.mobileImagePath ? [{ path: v.mobileImagePath, alt: "", isMain: true }] : []} onChange={(imgs) => setV({ ...v, mobileImagePath: imgs[0]?.path ?? null })} />
            </Field>
          </FormSection>
          <FormSection title="Link, período e ordem">
            <Field label="Link" htmlFor="b-link" error={errors.linkUrl} hint="Caminho interno (/pt-br/ofertas) ou https://">
              <input id="b-link" className={inputCls} value={v.linkUrl} onChange={(e) => setV({ ...v, linkUrl: e.target.value })} />
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Data inicial" htmlFor="b-start" error={errors.startsAt}>
                <input id="b-start" type="datetime-local" className={inputCls} value={v.startsAt} onChange={(e) => setV({ ...v, startsAt: e.target.value })} />
              </Field>
              <Field label="Data final" htmlFor="b-end" error={errors.endsAt}>
                <input id="b-end" type="datetime-local" className={inputCls} value={v.endsAt} onChange={(e) => setV({ ...v, endsAt: e.target.value })} />
              </Field>
              <Field label="Ordem" htmlFor="b-order">
                <input id="b-order" type="number" min={0} className={inputCls} value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Campanha (opcional)" htmlFor="b-camp">
              <select id="b-camp" className={inputCls} value={v.campaignId ?? ""} onChange={(e) => setV({ ...v, campaignId: e.target.value || null })}>
                <option value="">Nenhuma</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Toggle checked={v.active} onChange={(active) => setV({ ...v, active })} label="Ativo" />
          </FormSection>
          <div className="flex flex-wrap gap-2 pt-4">
            <button type="submit" disabled={pending} className={btnSecondary}>Salvar</button>
            <button type="button" disabled={pending} onClick={() => submit(true)} className={btnPrimary}>Publicar</button>
            <button type="button" onClick={() => setView("preview")} className={btnSecondary}>Pré-visualizar</button>
            {v.id && <ConfirmButton label="Excluir banner" title="Excluir banner?" description="O banner será removido permanentemente." confirmLabel="Excluir" onConfirm={() => run(() => deleteBanner({ id: v.id }), { success: "Banner excluído.", onSuccess: () => router.push("/admin/banners") })} />}
          </div>
        </form>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ campaign
export type CampaignFormValue = {
  id?: string;
  slug: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: "draft" | "scheduled" | "active" | "ended";
  productIds: string[];
  bannerIds: string[];
  translations: Partial<Record<LocaleCode, { title: string; description: string }>>;
};

export function CampaignForm({ initial, products, banners }: { initial: CampaignFormValue; products: Opt[]; banners: Opt[] }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [v, setV] = useState({ ...initial, startsAt: toLocalInput(initial.startsAt), endsAt: toLocalInput(initial.endsAt) });
  const [tab, setTab] = useState<LocaleCode>("pt-BR");
  const [errors, setErrors] = useState<Errors>({});
  const [pick, setPick] = useState("");
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const t = v.translations[tab] ?? { title: "", description: "" };
  const byId = new Map(products.map((p) => [p.id, p.name]));
  return (
    <form
      className="max-w-5xl"
      onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        run(() => saveCampaign({ ...v, startsAt: toIso(v.startsAt), endsAt: toIso(v.endsAt) }), { success: "Campanha salva.", onSuccess: (d) => !v.id && router.push(`/admin/campanhas/${d.id}`), onError: (r) => setErrors(r.fieldErrors ?? {}) });
      }}
    >
      <FormSection title="Campanha">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome interno" htmlFor="c-name" error={errors.name}>
            <input id="c-name" className={inputCls} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value, slug: slugTouched ? v.slug : slugify(e.target.value) })} />
          </Field>
          <Field label="Slug (página pública)" htmlFor="c-slug" error={errors.slug}>
            <input id="c-slug" className={`${inputCls} font-mono`} value={v.slug} onChange={(e) => { setSlugTouched(true); setV({ ...v, slug: e.target.value }); }} />
          </Field>
          <Field label="Início" htmlFor="c-start" error={errors.startsAt}>
            <input id="c-start" type="datetime-local" className={inputCls} value={v.startsAt} onChange={(e) => setV({ ...v, startsAt: e.target.value })} />
          </Field>
          <Field label="Fim" htmlFor="c-end" error={errors.endsAt}>
            <input id="c-end" type="datetime-local" className={inputCls} value={v.endsAt} onChange={(e) => setV({ ...v, endsAt: e.target.value })} />
          </Field>
          <Field label="Status" htmlFor="c-status">
            <select id="c-status" className={inputCls} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as CampaignFormValue["status"] })}>
              <option value="draft">Rascunho</option>
              <option value="scheduled">Agendada</option>
              <option value="active">Ativa</option>
              <option value="ended">Encerrada</option>
            </select>
          </Field>
        </div>
      </FormSection>
      <FormSection title="Página pública" description="Título e descrição exibidos na página da campanha.">
        <LocaleTabs value={tab} onChange={setTab} filled={Object.fromEntries(Object.entries(v.translations).map(([k, x]) => [k, !!x?.title]))} />
        <Field label="Título" htmlFor="c-title" error={errors[`translations.${tab}.title`]}>
          <input id="c-title" className={inputCls} maxLength={160} value={t.title} onChange={(e) => setV({ ...v, translations: { ...v.translations, [tab]: { ...t, title: e.target.value } } })} />
        </Field>
        <Field label="Descrição" htmlFor="c-desc">
          <textarea id="c-desc" className={textareaCls} rows={3} maxLength={2000} value={t.description} onChange={(e) => setV({ ...v, translations: { ...v.translations, [tab]: { ...t, description: e.target.value } } })} />
        </Field>
      </FormSection>
      <FormSection title="Produtos" description="Na ordem em que aparecem na página.">
        <ul className="space-y-1">
          {v.productIds.map((id, i) => (
            <li key={id} className="flex items-center justify-between panel px-3 py-2 text-sm">
              <span>{i + 1}. {byId.get(id) ?? id}</span>
              <button type="button" onClick={() => setV({ ...v, productIds: v.productIds.filter((x) => x !== id) })} className="cursor-pointer text-xs underline">Remover</button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1"><ProductPicker id="c-pick" products={products.filter((p) => !v.productIds.includes(p.id))} value={pick} onChange={setPick} /></div>
          <button type="button" disabled={!pick} className={btnSecondary} onClick={() => { setV({ ...v, productIds: [...v.productIds, pick] }); setPick(""); }}>Adicionar produto</button>
        </div>
      </FormSection>
      <FormSection title="Banners">
        {banners.length === 0 && <p className="text-sm text-mute">Nenhum banner cadastrado.</p>}
        <div className="space-y-2">
          {banners.map((b) => (
            <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-black" checked={v.bannerIds.includes(b.id)} onChange={(e) => setV({ ...v, bannerIds: e.target.checked ? [...v.bannerIds, b.id] : v.bannerIds.filter((x) => x !== b.id) })} />
              {b.name}
            </label>
          ))}
        </div>
      </FormSection>
      <div className="flex flex-wrap gap-2 pt-4">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Salvando…" : "Salvar campanha"}</button>
        <button type="button" onClick={() => router.push("/admin/campanhas")} className={btnSecondary}>Voltar</button>
        {v.id && <ConfirmButton label="Excluir campanha" title="Excluir campanha?" description="Cliques já registrados permanecem, sem vínculo com a campanha." confirmLabel="Excluir" onConfirm={() => run(() => deleteCampaign({ id: v.id }), { success: "Campanha excluída.", onSuccess: () => router.push("/admin/campanhas") })} />}
      </div>
    </form>
  );
}
