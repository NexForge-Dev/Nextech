"use client";
import { useState } from "react";
import Link from "next/link";
import { inviteAdmin, saveSettings, setMessageHandled, updateAdmin } from "@/actions/admin/people";
import { SOCIAL_KEYS } from "@/lib/admin/schemas/settings";
import { btnPrimary, btnSecondary, ConfirmButton, Field, FormSection, inputCls, LocaleTabs, textareaCls, Toggle, useAdminAction, type LocaleCode } from "./form";
import type { BusinessModels } from "@/lib/domain/business-models";
import { ImageUploader } from "./image-uploader";
import { DEFAULT_CONTACT_EMAIL } from "@/lib/domain/seller";

type PerLocale<T> = Partial<Record<LocaleCode, T>>;
export type SettingsValue = {
  storeName: string;
  contactEmail: string;
  logoPath: string | null;
  faviconPath: string | null;
  heroImage: string | null;
  institutional: PerLocale<string>;
  socials: Partial<Record<(typeof SOCIAL_KEYS)[number], string>>;
  seo: PerLocale<{ title: string; description: string }>;
  analytics: { ga4: string; plausible: string; googleAds: string; googleAdsConversion: string; metaPixel: string };
  cookieTexts: PerLocale<{ title: string; text: string }>;
  legal: { company_name: string; tax_id: string; address: string };
  priceStaleDays: number;
  businessModels: BusinessModels;
};

const TABS = [
  ["store", "Loja"],
  ["models", "Modelos de negócio"],
  ["contact", "Contato e redes sociais"],
  ["seo", "SEO"],
  ["analytics", "Analytics"],
  ["cookies", "Cookies"],
  ["integrations", "Integrações"],
  ["legal", "Informações legais"],
] as const;

export function SettingsForm({ initial }: { initial: SettingsValue }) {
  const { pending, run } = useAdminAction();
  const [v, setV] = useState(initial);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("store");
  const [loc, setLoc] = useState<LocaleCode>("pt-BR");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const e = (k: string) => errors[k];
  return (
    <form
      className="max-w-5xl"
      onSubmit={(ev) => {
        ev.preventDefault();
        setErrors({});
        run(() => saveSettings(v), { success: "Configurações salvas.", onError: (r) => setErrors(r.fieldErrors ?? {}) });
      }}
    >
      <div role="tablist" className="mb-6 flex flex-wrap gap-1 border-b border-line">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm ${tab === k ? "border-black font-medium" : "border-transparent text-mute hover:text-black"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "store" && (
        <>
          <FormSection title="Identidade">
            <Field label="Nome da loja" htmlFor="st-name" error={e("storeName")}>
              <input id="st-name" className={inputCls} value={v.storeName} maxLength={60} onChange={(x) => setV({ ...v, storeName: x.target.value })} />
            </Field>
            <Field label="Logotipo (opcional — o padrão é o texto NEXTECH)">
              <ImageUploader bucket="site" multiple={false} label="Enviar logotipo" value={v.logoPath ? [{ path: v.logoPath, alt: "", isMain: true }] : []} onChange={(i) => setV({ ...v, logoPath: i[0]?.path ?? null })} />
            </Field>
            <Field label="Favicon" hint="PNG quadrado (ex.: 512×512).">
              <ImageUploader bucket="site" multiple={false} label="Enviar favicon" value={v.faviconPath ? [{ path: v.faviconPath, alt: "", isMain: true }] : []} onChange={(i) => setV({ ...v, faviconPath: i[0]?.path ?? null })} />
            </Field>
            <Field label="Imagem do destaque da página inicial (opcional)">
              <ImageUploader bucket="site" multiple={false} label="Enviar imagem" value={v.heroImage ? [{ path: v.heroImage, alt: "", isMain: true }] : []} onChange={(i) => setV({ ...v, heroImage: i[0]?.path ?? null })} />
            </Field>
          </FormSection>
          <FormSection title="Descrição institucional" description="Exibida no topo da página “Sobre”.">
            <LocaleTabs value={loc} onChange={setLoc} filled={Object.fromEntries(Object.entries(v.institutional).map(([k, x]) => [k, !!x]))} />
            <textarea aria-label="Descrição institucional" className={textareaCls} rows={4} maxLength={2000} value={v.institutional[loc] ?? ""} onChange={(x) => setV({ ...v, institutional: { ...v.institutional, [loc]: x.target.value } })} />
          </FormSection>
        </>
      )}

      {tab === "contact" && (
        <FormSection title="Contato e redes sociais">
          <Field label="E-mail de contato" htmlFor="st-email" error={e("contactEmail")}>
            <input id="st-email" type="email" className={inputCls} value={v.contactEmail} onChange={(x) => setV({ ...v, contactEmail: x.target.value })} />
          </Field>
          {SOCIAL_KEYS.map((k) => (
            <Field key={k} label={k[0].toUpperCase() + k.slice(1)} htmlFor={`so-${k}`} error={e(`socials.${k}`)}>
              <input id={`so-${k}`} className={inputCls} placeholder="https://" value={v.socials[k] ?? ""} onChange={(x) => setV({ ...v, socials: { ...v.socials, [k]: x.target.value } })} />
            </Field>
          ))}
        </FormSection>
      )}

      {tab === "seo" && (
        <FormSection title="SEO padrão" description="Título e descrição da página inicial e padrão das demais páginas, por idioma.">
          <LocaleTabs value={loc} onChange={setLoc} filled={Object.fromEntries(Object.entries(v.seo).map(([k, x]) => [k, !!x?.title]))} />
          <Field label="Título" htmlFor="seo-t" hint={`${(v.seo[loc]?.title ?? "").length}/70`}>
            <input id="seo-t" className={inputCls} maxLength={70} value={v.seo[loc]?.title ?? ""} onChange={(x) => setV({ ...v, seo: { ...v.seo, [loc]: { title: x.target.value, description: v.seo[loc]?.description ?? "" } } })} />
          </Field>
          <Field label="Descrição" htmlFor="seo-d" hint={`${(v.seo[loc]?.description ?? "").length}/170`}>
            <textarea id="seo-d" className={textareaCls} rows={3} maxLength={170} value={v.seo[loc]?.description ?? ""} onChange={(x) => setV({ ...v, seo: { ...v.seo, [loc]: { title: v.seo[loc]?.title ?? "", description: x.target.value } } })} />
          </Field>
        </FormSection>
      )}

      {tab === "analytics" && (
        <FormSection title="Ferramentas de análise" description="Carregadas somente para visitantes que aceitarem cookies de análise.">
          <Field label="Google Analytics 4 — ID de medição" htmlFor="an-ga" error={e("analytics.ga4")}>
            <input id="an-ga" className={`${inputCls} font-mono`} placeholder="G-XXXXXXX" value={v.analytics.ga4} onChange={(x) => setV({ ...v, analytics: { ...v.analytics, ga4: x.target.value.trim() } })} />
          </Field>
          <Field label="Plausible — domínio" htmlFor="an-pl" error={e("analytics.plausible")}>
            <input id="an-pl" className={`${inputCls} font-mono`} placeholder="nextech.com" value={v.analytics.plausible} onChange={(x) => setV({ ...v, analytics: { ...v.analytics, plausible: x.target.value.trim() } })} />
          </Field>
        </FormSection>
      )}

      {tab === "analytics" && (
        <FormSection title="Anúncios e conversões" description="Carregados somente para visitantes que aceitarem cookies de marketing. O clique em “Comprar” é enviado como conversão.">
          <Field label="Google Ads — ID da tag" htmlFor="an-aw" error={e("analytics.googleAds")} hint="Google Ads → Ferramentas → Conversões → Configurar tag.">
            <input id="an-aw" className={`${inputCls} font-mono`} placeholder="AW-123456789" value={v.analytics.googleAds} onChange={(x) => setV({ ...v, analytics: { ...v.analytics, googleAds: x.target.value.trim() } })} />
          </Field>
          <Field label="Google Ads — rótulo da conversão “Comprar”" htmlFor="an-awl" error={e("analytics.googleAdsConversion")} hint="Parte depois da barra em send_to: 'AW-123456789/AbC-dEfG'. Opcional.">
            <input id="an-awl" className={`${inputCls} font-mono`} placeholder="AbC-dEfGhIj" value={v.analytics.googleAdsConversion} onChange={(x) => setV({ ...v, analytics: { ...v.analytics, googleAdsConversion: x.target.value.trim() } })} />
          </Field>
          <Field label="Meta Pixel — ID" htmlFor="an-fb" error={e("analytics.metaPixel")} hint="Gerenciador de Eventos da Meta → Fontes de dados → ID do pixel.">
            <input id="an-fb" className={`${inputCls} font-mono`} placeholder="1234567890123456" value={v.analytics.metaPixel} onChange={(x) => setV({ ...v, analytics: { ...v.analytics, metaPixel: x.target.value.trim() } })} />
          </Field>
        </FormSection>
      )}

      {tab === "cookies" && (
        <FormSection title="Banner de cookies" description="Deixe em branco para usar o texto padrão de cada idioma.">
          <LocaleTabs value={loc} onChange={setLoc} filled={Object.fromEntries(Object.entries(v.cookieTexts).map(([k, x]) => [k, !!x?.text]))} />
          <Field label="Título" htmlFor="ck-t">
            <input id="ck-t" className={inputCls} maxLength={80} value={v.cookieTexts[loc]?.title ?? ""} onChange={(x) => setV({ ...v, cookieTexts: { ...v.cookieTexts, [loc]: { title: x.target.value, text: v.cookieTexts[loc]?.text ?? "" } } })} />
          </Field>
          <Field label="Texto" htmlFor="ck-x">
            <textarea id="ck-x" className={textareaCls} rows={3} maxLength={500} value={v.cookieTexts[loc]?.text ?? ""} onChange={(x) => setV({ ...v, cookieTexts: { ...v.cookieTexts, [loc]: { title: v.cookieTexts[loc]?.title ?? "", text: x.target.value } } })} />
          </Field>
        </FormSection>
      )}

      {tab === "models" && (
        <FormSection title="Modelos de negócio" description="Ligue ou desligue cada modelo sem apagar nada. Produtos de um modelo desligado ficam guardados e invisíveis na loja.">
          <div className="space-y-4">
            <div>
              <Toggle checked={v.businessModels.ownStock} onChange={(ownStock) => setV({ ...v, businessModels: { ...v.businessModels, ownStock } })} label="Venda própria — produtos do seu estoque, com baixa automática a cada venda" />
            </div>
            <div>
              <Toggle checked={v.businessModels.dropshipping} onChange={(dropshipping) => setV({ ...v, businessModels: { ...v.businessModels, dropshipping } })} label="Dropshipping — o cliente paga na loja e o fornecedor envia" />
            </div>
            <div>
              <Toggle checked={v.businessModels.affiliates} onChange={(affiliates) => setV({ ...v, businessModels: { ...v.businessModels, affiliates } })} label="Afiliados — botões “ver na loja”, /go e páginas de afiliados" />
              <p className="mt-1 text-xs text-mute">Com afiliados desligados, a loja funciona só em português do Brasil. Para escolher quais lojas parceiras aparecem, como só o AliExpress, ative ou desative cada uma em Lojas.</p>
            </div>
          </div>
        </FormSection>
      )}

      {tab === "models" && (
        <FormSection title="Formas de pagamento" description="Usadas no checkout da loja própria (Stripe).">
          <div className="space-y-4">
            <div><Toggle checked={v.businessModels.payments.card} onChange={(card) => setV({ ...v, businessModels: { ...v.businessModels, payments: { ...v.businessModels.payments, card } } })} label="Cartão de crédito e débito (à vista)" /></div>
            <div><Toggle checked={v.businessModels.payments.boleto} onChange={(boleto) => setV({ ...v, businessModels: { ...v.businessModels, payments: { ...v.businessModels.payments, boleto } } })} label="Boleto (confirma em até 1 dia útil; reembolso feito por fora)" /></div>
            <div>
              <Toggle checked={v.businessModels.payments.pix} onChange={(pix) => setV({ ...v, businessModels: { ...v.businessModels, payments: { ...v.businessModels.payments, pix } } })} label="Pix" />
              <p className="mt-1 text-xs text-mute">No Stripe Brasil o Pix é liberado por convite. Ligue só depois que o Stripe aprovar a sua conta.</p>
            </div>
            {e("businessModels.payments") && <p role="alert" className="text-sm font-medium text-black">{e("businessModels.payments")?.[0]}</p>}
          </div>
        </FormSection>
      )}

      {tab === "integrations" && (
        <FormSection title="Integrações" description="Credenciais e parâmetros de cada rede ficam em Redes de afiliados.">
          <Link href="/admin/afiliados" className={btnSecondary}>Abrir redes de afiliados</Link>
          <Field label="Alerta de preço desatualizado (dias)" htmlFor="ops-stale" error={e("priceStaleDays")} hint="Notifica ofertas com preço mais antigo que isso.">
            <input id="ops-stale" type="number" min={1} max={365} className={`${inputCls} max-w-32`} value={v.priceStaleDays} onChange={(x) => setV({ ...v, priceStaleDays: Number(x.target.value) })} />
          </Field>
        </FormSection>
      )}

      {tab === "legal" && (
        <FormSection title="Informações legais" description={`Obrigatórias para vender (Decreto 7.962/2013): aparecem no rodapé de todas as páginas, no checkout, nos termos de venda e na política de privacidade. Campos vazios não aparecem para o cliente, e o checkout fica fechado até nome, CPF ou CNPJ e endereço estarem preenchidos. Use os seus dados exatos, de CPF ou CNPJ; o e-mail de contato fica na aba Contato e, em branco, a loja usa ${DEFAULT_CONTACT_EMAIL}.`}>
          {(!v.legal.company_name.trim() || !v.legal.tax_id.trim() || !v.legal.address.trim()) && (
            <p role="alert" className="rounded-md border border-black px-4 py-3 text-sm font-medium">
              Faltam dados do vendedor: {[!v.legal.company_name.trim() && "nome ou razão social", !v.legal.tax_id.trim() && "CPF ou CNPJ", !v.legal.address.trim() && "endereço"].filter(Boolean).join(", ")}. O checkout fica fechado até preencher.
            </p>
          )}
          <Field label="Nome ou razão social" htmlFor="lg-name">
            <input id="lg-name" className={inputCls} value={v.legal.company_name} onChange={(x) => setV({ ...v, legal: { ...v.legal, company_name: x.target.value } })} />
          </Field>
          <Field label="CPF ou CNPJ" htmlFor="lg-tax" hint="Só os números ou formatado. Com 11 dígitos, a loja mostra como CPF (o MEI tem CNPJ).">
            <input id="lg-tax" className={inputCls} value={v.legal.tax_id} onChange={(x) => setV({ ...v, legal: { ...v.legal, tax_id: x.target.value } })} />
          </Field>
          <Field label="Endereço" htmlFor="lg-addr" hint="Endereço físico completo: rua, número, bairro, cidade/UF e CEP.">
            <textarea id="lg-addr" className={textareaCls} rows={2} value={v.legal.address} onChange={(x) => setV({ ...v, legal: { ...v.legal, address: x.target.value } })} />
          </Field>
        </FormSection>
      )}

      <div className="pt-4">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Salvando…" : "Salvar configurações"}</button>
      </div>
    </form>
  );
}

export function MessageActions({ id, handled }: { id: string; handled: boolean }) {
  const { pending, run } = useAdminAction();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => setMessageHandled({ id, handled: !handled }), { success: handled ? "Marcada como pendente." : "Marcada como resolvida." })} className={btnSecondary}>
      {handled ? "Reabrir" : "Marcar como resolvida"}
    </button>
  );
}

export function InviteAdminForm() {
  const { pending, run } = useAdminAction();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => inviteAdmin({ email, role }), { success: "Administrador adicionado. Se a pessoa ainda não tinha conta, ela recebe um convite por e-mail.", onSuccess: () => setEmail("") });
      }}
    >
      <Field label="E-mail" htmlFor="inv-email">
        <input id="inv-email" type="email" required className={`${inputCls} w-full sm:w-72`} value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Perfil" htmlFor="inv-role">
        <select id="inv-role" className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="editor">Editor</option>
          <option value="admin">Administrador</option>
          <option value="superadmin">Superadministrador</option>
        </select>
      </Field>
      <button type="submit" disabled={pending} className={btnPrimary}>Convidar</button>
    </form>
  );
}

export function AdminRowActions({ userId, role, active, isSelf }: { userId: string; role: string; active: boolean; isSelf: boolean }) {
  const { pending, run } = useAdminAction();
  if (isSelf) return <span className="text-xs text-mute">Você</span>;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <select aria-label="Perfil" disabled={pending} value={role} onChange={(e) => run(() => updateAdmin({ userId, role: e.target.value }), { success: "Perfil atualizado." })} className="h-11 rounded-md border border-line bg-white px-2 text-base md:h-8 md:text-sm">
        <option value="editor">Editor</option>
        <option value="admin">Administrador</option>
        <option value="superadmin">Superadministrador</option>
      </select>
      {active ? (
        <ConfirmButton label="Desativar" className="h-8 cursor-pointer rounded-md border border-line px-3 text-xs font-medium hover:bg-soft" title="Desativar administrador?" description="A pessoa perde o acesso ao painel imediatamente." confirmLabel="Desativar" onConfirm={() => run(() => updateAdmin({ userId, active: false }), { success: "Administrador desativado." })} />
      ) : (
        <button type="button" disabled={pending} onClick={() => run(() => updateAdmin({ userId, active: true }), { success: "Administrador reativado." })} className="h-8 cursor-pointer rounded-md border border-line px-3 text-xs font-medium hover:bg-soft">Reativar</button>
      )}
    </div>
  );
}
