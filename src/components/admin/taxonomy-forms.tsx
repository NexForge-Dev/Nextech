"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { CATEGORY_ICONS, CategoryIcon } from "@/components/category-icon";
import { slugify } from "@/lib/domain/slug";
import { saveBrand, saveCategory, saveStore, deleteBrand, deleteCategory, deleteStore, moveCategory } from "@/actions/admin/taxonomy";
import { AMAZON_DOMAINS } from "@/lib/admin/schemas/store";
import { btnPrimary, btnSecondary, ConfirmButton, Field, FormSection, inputCls, LocaleTabs, textareaCls, Toggle, useAdminAction, type LocaleCode } from "./form";
import { ImageUploader } from "./image-uploader";

type Errors = Record<string, string[]>;

// ------------------------------------------------------------------ category
export type CategoryFormValue = {
  id?: string;
  slug: string;
  icon: string;
  imagePath: string | null;
  sortOrder: number;
  active: boolean;
  translations: Partial<Record<LocaleCode, { name: string; description: string }>>;
};

export function CategoryForm({ initial }: { initial: CategoryFormValue }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [v, setV] = useState(initial);
  const [tab, setTab] = useState<LocaleCode>("pt-BR");
  const [errors, setErrors] = useState<Errors>({});
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const t = v.translations[tab] ?? { name: "", description: "" };
  const setT = (patch: Partial<{ name: string; description: string }>) => {
    const next = { ...v.translations, [tab]: { ...t, ...patch } };
    setV({ ...v, translations: next, slug: !slugTouched && tab === "pt-BR" && patch.name !== undefined ? slugify(patch.name) : v.slug });
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        run(() => saveCategory(v), { success: "Categoria salva.", onSuccess: (d) => router.push(`/admin/categorias/${d.id}`), onError: (r) => setErrors(r.fieldErrors ?? {}) });
      }}
      className="max-w-5xl"
    >
      <FormSection title="Nome e descrição" description="O nome em português (Brasil) é obrigatório. Os outros idiomas usam o português como reserva.">
        <LocaleTabs value={tab} onChange={setTab} filled={Object.fromEntries(Object.entries(v.translations).map(([k, x]) => [k, !!x?.name]))} />
        <Field label="Nome" htmlFor="c-name" error={errors[`translations.${tab}.name`] ?? (tab === "pt-BR" ? errors["translations.pt-BR"] : undefined)}>
          <input id="c-name" className={inputCls} value={t.name} onChange={(e) => setT({ name: e.target.value })} maxLength={80} />
        </Field>
        <Field label="Descrição" htmlFor="c-desc">
          <textarea id="c-desc" className={textareaCls} rows={3} value={t.description} onChange={(e) => setT({ description: e.target.value })} maxLength={1000} />
        </Field>
      </FormSection>
      <FormSection title="Identificação">
        <Field label="Slug" htmlFor="c-slug" error={errors.slug} hint="Endereço da categoria na loja.">
          <input id="c-slug" className={`${inputCls} font-mono`} value={v.slug} onChange={(e) => { setSlugTouched(true); setV({ ...v, slug: e.target.value }); }} />
        </Field>
        <Field label="Ordem de exibição" htmlFor="c-order" error={errors.sortOrder}>
          <input id="c-order" type="number" min={0} className={`${inputCls} max-w-32`} value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) })} />
        </Field>
        <Toggle checked={v.active} onChange={(active) => setV({ ...v, active })} label="Categoria ativa na loja" />
      </FormSection>
      <FormSection title="Ícone e imagem">
        <Field label="Ícone" error={errors.icon}>
          <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
            {CATEGORY_ICONS.map((name) => (
              <button key={name} type="button" title={name} aria-label={name} aria-pressed={v.icon === name} onClick={() => setV({ ...v, icon: name })} className={`grid aspect-square cursor-pointer place-items-center rounded-md border ${v.icon === name ? "border-black bg-black text-white" : "border-line hover:bg-soft"}`}>
                <CategoryIcon name={name} className="size-4" />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Imagem (opcional)">
          <ImageUploader bucket="categories" multiple={false} label="Enviar imagem" value={v.imagePath ? [{ path: v.imagePath, alt: "", isMain: true }] : []} onChange={(imgs) => setV({ ...v, imagePath: imgs[0]?.path ?? null })} />
        </Field>
      </FormSection>
      <div className="flex gap-2 pt-6">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Salvando…" : "Salvar categoria"}</button>
        <button type="button" onClick={() => router.push("/admin/categorias")} className={btnSecondary}>Cancelar</button>
      </div>
    </form>
  );
}

export function CategoryRowActions({ id, name }: { id: string; name: string }) {
  const { pending, run } = useAdminAction();
  return (
    <div className="flex justify-end gap-1">
      <button type="button" disabled={pending} aria-label={`Subir ${name}`} onClick={() => run(() => moveCategory({ id, direction: "up" }))} className="grid size-8 cursor-pointer place-items-center rounded-md hover:bg-soft"><ArrowUp className="size-4" /></button>
      <button type="button" disabled={pending} aria-label={`Descer ${name}`} onClick={() => run(() => moveCategory({ id, direction: "down" }))} className="grid size-8 cursor-pointer place-items-center rounded-md hover:bg-soft"><ArrowDown className="size-4" /></button>
      <ConfirmButton
        label={<Trash2 className="size-4" aria-label={`Excluir ${name}`} />}
        className="grid size-8 cursor-pointer place-items-center rounded-md hover:bg-soft"
        title="Excluir categoria?"
        description={`A categoria "${name}" será excluída. Categorias com produtos não podem ser excluídas.`}
        confirmLabel="Excluir"
        onConfirm={() => run(() => deleteCategory({ id }), { success: "Categoria excluída." })}
      />
    </div>
  );
}

// ------------------------------------------------------------------ brand
export type BrandFormValue = { id?: string; name: string; slug: string; logoPath: string | null; active: boolean };

export function BrandForm({ initial }: { initial: BrandFormValue }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        run(() => saveBrand(v), { success: "Marca salva.", onSuccess: () => router.push("/admin/marcas"), onError: (r) => setErrors(r.fieldErrors ?? {}) });
      }}
      className="max-w-5xl"
    >
      <FormSection title="Marca">
        <Field label="Nome" htmlFor="b-name" error={errors.name}>
          <input id="b-name" className={inputCls} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value, slug: slugTouched ? v.slug : slugify(e.target.value) })} maxLength={120} />
        </Field>
        <Field label="Slug" htmlFor="b-slug" error={errors.slug}>
          <input id="b-slug" className={`${inputCls} font-mono`} value={v.slug} onChange={(e) => { setSlugTouched(true); setV({ ...v, slug: e.target.value }); }} />
        </Field>
        <Toggle checked={v.active} onChange={(active) => setV({ ...v, active })} label="Marca ativa" />
        <Field label="Logotipo (opcional)">
          <ImageUploader bucket="brands" multiple={false} label="Enviar logotipo" value={v.logoPath ? [{ path: v.logoPath, alt: "", isMain: true }] : []} onChange={(imgs) => setV({ ...v, logoPath: imgs[0]?.path ?? null })} />
        </Field>
      </FormSection>
      <div className="flex flex-wrap gap-2 pt-6">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Salvando…" : "Salvar marca"}</button>
        <button type="button" onClick={() => router.push("/admin/marcas")} className={btnSecondary}>Cancelar</button>
        {v.id && (
          <ConfirmButton label="Excluir marca" title="Excluir marca?" description="Os produtos desta marca ficarão sem marca." confirmLabel="Excluir" onConfirm={() => run(() => deleteBrand({ id: v.id }), { success: "Marca excluída.", onSuccess: () => router.push("/admin/marcas") })} />
        )}
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ store
export type StoreFormValue = {
  id?: string;
  name: string;
  slug: string;
  logoPath: string | null;
  officialUrl: string;
  description: string;
  networkId: string | null;
  markets: string[];
  priceDisplayPolicy: "inherit" | "show" | "link_only";
  domains: string[];
  active: boolean;
  createdAt?: string;
};

export function StoreForm({ initial, networks, markets }: { initial: StoreFormValue; networks: { id: string; name: string; adapter: string; policy: string }[]; markets: { code: string; name: string; active: boolean }[] }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [domainInput, setDomainInput] = useState("");
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const network = networks.find((n) => n.id === v.networkId);
  const isAmazon = network?.adapter === "amazon" || network?.adapter === "amazon_paapi";
  const suggested = isAmazon ? [...new Set([...v.markets.flatMap((m) => AMAZON_DOMAINS[m] ?? []), "amzn.to"])].filter((d) => !v.domains.includes(d)) : [];
  const addDomain = (d: string) => {
    const clean = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    if (clean && !v.domains.includes(clean)) setV({ ...v, domains: [...v.domains, clean] });
    setDomainInput("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        run(() => saveStore(v), { success: "Loja salva.", onSuccess: (d) => router.push(`/admin/lojas/${d.id}`), onError: (r) => setErrors(r.fieldErrors ?? {}) });
      }}
      className="max-w-5xl"
    >
      <FormSection title="Loja" description={v.createdAt ? `Cadastrada em ${new Date(v.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : undefined}>
        <Field label="Nome" htmlFor="s-name" error={errors.name}>
          <input id="s-name" className={inputCls} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value, slug: slugTouched ? v.slug : slugify(e.target.value) })} maxLength={80} />
        </Field>
        <Field label="Slug" htmlFor="s-slug" error={errors.slug}>
          <input id="s-slug" className={`${inputCls} font-mono`} value={v.slug} onChange={(e) => { setSlugTouched(true); setV({ ...v, slug: e.target.value }); }} />
        </Field>
        <Field label="URL oficial" htmlFor="s-url" error={errors.officialUrl}>
          <input id="s-url" className={inputCls} value={v.officialUrl} onChange={(e) => setV({ ...v, officialUrl: e.target.value })} placeholder="https://www.loja.com" />
        </Field>
        <Field label="Descrição" htmlFor="s-desc" error={errors.description}>
          <textarea id="s-desc" className={textareaCls} rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={2000} />
        </Field>
        <Toggle checked={v.active} onChange={(active) => setV({ ...v, active })} label="Loja ativa" />
        <Field label="Logotipo (opcional)">
          <ImageUploader bucket="stores" multiple={false} label="Enviar logotipo" value={v.logoPath ? [{ path: v.logoPath, alt: "", isMain: true }] : []} onChange={(imgs) => setV({ ...v, logoPath: imgs[0]?.path ?? null })} />
        </Field>
      </FormSection>
      <FormSection title="Programa de afiliados" description="A política de preço define se a loja pode mostrar preços na NEXTECH. Amazon exige preços da API oficial.">
        <Field label="Rede de afiliados" htmlFor="s-net">
          <select id="s-net" className={inputCls} value={v.networkId ?? ""} onChange={(e) => setV({ ...v, networkId: e.target.value || null })}>
            <option value="">Nenhuma (link manual)</option>
            {networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </Field>
        <Field label="Exibição de preço" htmlFor="s-policy" hint={network ? `Padrão da rede: ${network.policy === "link_only" ? "somente link" : "mostrar preço"}` : undefined}>
          <select id="s-policy" className={inputCls} value={v.priceDisplayPolicy} onChange={(e) => setV({ ...v, priceDisplayPolicy: e.target.value as StoreFormValue["priceDisplayPolicy"] })}>
            <option value="inherit">Herdar da rede</option>
            <option value="show">Mostrar preço</option>
            <option value="link_only">Somente link (“Ver preço na loja”)</option>
          </select>
        </Field>
      </FormSection>
      <FormSection title="Países atendidos">
        <div className="flex flex-wrap gap-2">
          {markets.map((m) => {
            const on = v.markets.includes(m.code);
            return (
              <button key={m.code} type="button" aria-pressed={on} onClick={() => setV({ ...v, markets: on ? v.markets.filter((x) => x !== m.code) : [...v.markets, m.code] })} className={`h-9 cursor-pointer rounded-md border px-3 text-sm ${on ? "border-black bg-black text-white" : "border-line hover:bg-soft"}`}>
                {m.name}{!m.active ? " (inativo)" : ""}
              </button>
            );
          })}
        </div>
      </FormSection>
      <FormSection title="Domínios permitidos" description="O redirecionamento /go só leva o visitante para estes domínios (e subdomínios). Protege contra redirecionamentos maliciosos.">
        <Field label="Domínios" error={errors.domains ?? Object.entries(errors).find(([k]) => k.startsWith("domains."))?.[1]}>
          <ul className="flex flex-wrap gap-2">
            {v.domains.map((d) => (
              <li key={d} className="inline-flex h-8 items-center gap-2 rounded-md border border-line pl-3 pr-1 font-mono text-xs">
                {d}
                <button type="button" aria-label={`Remover ${d}`} onClick={() => setV({ ...v, domains: v.domains.filter((x) => x !== d) })} className="grid size-8 cursor-pointer place-items-center rounded hover:bg-soft"><Trash2 className="size-3.5" /></button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input aria-label="Novo domínio" className={`${inputCls} max-w-xs font-mono`} value={domainInput} onChange={(e) => setDomainInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDomain(domainInput); } }} placeholder="loja.com.br" />
            <button type="button" onClick={() => addDomain(domainInput)} className={btnSecondary}>Adicionar</button>
          </div>
          {suggested.length > 0 && (
            <p className="mt-2 text-xs text-mute">
              Sugestões Amazon:{" "}
              {suggested.map((d) => (
                <button key={d} type="button" onClick={() => addDomain(d)} className="mr-2 cursor-pointer font-mono underline">{d}</button>
              ))}
            </p>
          )}
        </Field>
      </FormSection>
      <div className="flex flex-wrap gap-2 pt-6">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Salvando…" : "Salvar loja"}</button>
        <button type="button" onClick={() => router.push("/admin/lojas")} className={btnSecondary}>Cancelar</button>
        {v.id && (
          <ConfirmButton label="Excluir loja" title="Excluir loja?" description="Lojas com links de afiliados não podem ser excluídas; desative-as." confirmLabel="Excluir" onConfirm={() => run(() => deleteStore({ id: v.id }), { success: "Loja excluída.", onSuccess: () => router.push("/admin/lojas") })} />
        )}
      </div>
    </form>
  );
}
