"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import { importConversions, removeCredentials, saveCredentials, saveNetwork, syncNow, testNetworkConnection } from "@/actions/admin/networks";
import { btnPrimary, btnSecondary, ConfirmButton, Field, FormSection, inputCls, Toggle, useAdminAction } from "./form";

type FieldDef = { name: string; label: string; secret?: boolean; hint?: string };

export type NetworkFormValue = { id?: string; key: string; adapter: string; name: string; subidParam: string; priceDisplayPolicy: "show" | "link_only"; settings: Record<string, string>; active: boolean };

export function NetworkForm({ initial, adapters, canWrite }: { initial: NetworkFormValue; adapters: { key: string; label: string; settingsFields: FieldDef[] }[]; canWrite: boolean }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const adapter = adapters.find((a) => a.key === v.adapter);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        run(() => saveNetwork(v), { success: "Rede salva.", onSuccess: (d) => !v.id && router.push(`/admin/afiliados/${d.id}`), onError: (r) => setErrors(r.fieldErrors ?? {}) });
      }}
    >
      <fieldset disabled={!canWrite} className="contents">
        <FormSection title="Rede" description="Identificadores não secretos (tags, IDs de publisher). Segredos ficam em Credenciais.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome" htmlFor="n-name" error={errors.name}>
              <input id="n-name" className={inputCls} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            </Field>
            <Field label="Chave" htmlFor="n-key" error={errors.key} hint="Identificador interno (ex.: awin-br).">
              <input id="n-key" className={`${inputCls} font-mono`} value={v.key} onChange={(e) => setV({ ...v, key: e.target.value })} disabled={!!v.id} />
            </Field>
            <Field label="Tipo de integração" htmlFor="n-adapter">
              <select id="n-adapter" className={inputCls} value={v.adapter} onChange={(e) => setV({ ...v, adapter: e.target.value })} disabled={!!v.id}>
                {adapters.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </Field>
            <Field label="Parâmetro de sub-ID" htmlFor="n-subid" error={errors.subidParam} hint="O /go acrescenta este parâmetro com o ID do clique para cruzar conversões (Awin: clickref, Admitad: subid, Impact: subId1).">
              <input id="n-subid" className={`${inputCls} font-mono`} value={v.subidParam} onChange={(e) => setV({ ...v, subidParam: e.target.value })} />
            </Field>
            <Field label="Exibição de preço" htmlFor="n-policy">
              <select id="n-policy" className={inputCls} value={v.priceDisplayPolicy} onChange={(e) => setV({ ...v, priceDisplayPolicy: e.target.value as "show" | "link_only" })}>
                <option value="show">Mostrar preço</option>
                <option value="link_only">Somente link (“Ver preço na loja”)</option>
              </select>
            </Field>
          </div>
          <Toggle checked={v.active} onChange={(active) => setV({ ...v, active })} label="Rede ativa (sincronização automática diária)" />
        </FormSection>
        {adapter && adapter.settingsFields.length > 0 && (
          <FormSection title="Parâmetros de rastreamento">
            <div className="grid gap-4 md:grid-cols-2">
              {adapter.settingsFields.map((f) => (
                <Field key={f.name} label={f.label} htmlFor={`s-${f.name}`} hint={f.hint}>
                  <input id={`s-${f.name}`} className={`${inputCls} font-mono`} value={v.settings[f.name] ?? ""} onChange={(e) => setV({ ...v, settings: { ...v.settings, [f.name]: e.target.value } })} />
                </Field>
              ))}
            </div>
          </FormSection>
        )}
        {canWrite && (
          <div className="flex gap-2 pt-4">
            <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Salvando…" : "Salvar rede"}</button>
          </div>
        )}
      </fieldset>
    </form>
  );
}

export function CredentialsForm({ networkId, fields, configured, last4 }: { networkId: string; fields: FieldDef[]; configured: boolean; last4: string }) {
  const { pending, run } = useAdminAction();
  const [values, setValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(!configured);
  if (!fields.length) return <p className="text-sm text-mute">Esta integração não usa credenciais.</p>;
  return (
    <div className="space-y-4">
      {configured && !editing ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">Configurado{last4 ? ` · ••••${last4}` : ""}</p>
          <button type="button" onClick={() => setEditing(true)} className={btnSecondary}>Substituir</button>
          <ConfirmButton label="Remover" title="Remover credenciais?" description="A sincronização por API deixará de funcionar até novas credenciais serem salvas." confirmLabel="Remover" onConfirm={() => run(() => removeCredentials({ id: networkId }), { success: "Credenciais removidas." })} />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveCredentials({ id: networkId, values }), { success: "Credenciais salvas e criptografadas.", onSuccess: () => { setValues({}); setEditing(false); } });
          }}
          className="space-y-4"
        >
          {fields.map((f) => (
            <Field key={f.name} label={f.label} htmlFor={`c-${f.name}`} hint={f.hint ?? (configured ? "Deixe em branco para manter o valor atual." : undefined)}>
              <input id={`c-${f.name}`} type={f.secret ? "password" : "text"} autoComplete="off" className={`${inputCls} font-mono`} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
            </Field>
          ))}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={btnPrimary}>Salvar credenciais</button>
            {configured && <button type="button" onClick={() => setEditing(false)} className={btnSecondary}>Cancelar</button>}
          </div>
          <p className="text-xs text-mute">As credenciais são criptografadas (AES-256-GCM) no servidor e nunca são exibidas novamente.</p>
        </form>
      )}
    </div>
  );
}

export function SyncButtons({ networkId, canTest, canSync }: { networkId: string; canTest: boolean; canSync: boolean }) {
  const { pending, run } = useAdminAction();
  return (
    <div className="flex flex-wrap gap-2">
      {canTest && (
        <button type="button" disabled={pending} className={btnSecondary} onClick={() => run(() => testNetworkConnection({ id: networkId }), { onSuccess: (d) => (d.ok ? toast.success(d.message) : toast.error(d.message)) })}>
          Testar conexão
        </button>
      )}
      {canSync && (
        <button type="button" disabled={pending} className={btnPrimary} onClick={() => run(() => syncNow({ id: networkId, days: 30 }), { onSuccess: (d) => toast.success(`Sincronizado: ${d.inserted} novo(s), ${d.updated} atualizado(s).`) })}>
          {pending ? "Sincronizando…" : "Sincronizar agora (30 dias)"}
        </button>
      )}
    </div>
  );
}

type Mapping = { externalId: string; date: string; status: string; saleAmount: string; commission: string; currency: string; clickRef: string };

export function ConversionImport({ networkId, adapter }: { networkId: string; adapter: string }) {
  const { pending, run } = useAdminAction();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({ externalId: "", date: "", status: "", saleAmount: "", commission: "", currency: "", clickRef: "" });
  const [statusMap, setStatusMap] = useState<Record<string, "pending" | "confirmed" | "rejected">>({});
  const [currency, setCurrency] = useState("BRL");
  const [result, setResult] = useState<{ rows: number; errors: { line: number; message: string }[]; inserted: number; updated: number; committed: boolean } | null>(null);
  const generic = adapter === "generic" || adapter === "awin" || adapter === "admitad" || adapter === "impact";

  async function onFile(f?: File) {
    setResult(null);
    if (!f) return;
    const text = await f.text();
    setFile({ name: f.name, text });
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, preview: 200, skipEmptyLines: true });
    setColumns(parsed.meta.fields ?? []);
    if (mapping.status) setStatuses([...new Set(parsed.data.map((r) => (r[mapping.status] ?? "").trim().toLowerCase()).filter(Boolean))]);
  }
  function setStatusColumn(col: string) {
    setMapping({ ...mapping, status: col });
    if (file) {
      const parsed = Papa.parse<Record<string, string>>(file.text, { header: true, skipEmptyLines: true });
      setStatuses([...new Set(parsed.data.map((r) => (r[col] ?? "").trim().toLowerCase()).filter(Boolean))].slice(0, 30));
    }
  }
  const payload = (commit: boolean) => ({ id: networkId, text: file!.text, filename: file!.name, commit, currency, ...(generic ? { mapping, statusMap } : {}) });
  const sel = `${inputCls} max-w-xs`;
  return (
    <div className="max-w-4xl space-y-6">
      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-mute p-6 hover:bg-soft">
        <Upload className="size-5" aria-hidden />
        <span className="text-sm">{file ? file.name : "Escolher relatório CSV da rede"}</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {adapter === "amazon" && (
        <Field label="Moeda do relatório" htmlFor="ci-cur" hint="O relatório Fee-Earnings da Amazon não traz a moeda.">
          <input id="ci-cur" className={`${sel} font-mono uppercase`} maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </Field>
      )}
      {generic && columns.length > 0 && (
        <FormSection title="Mapeamento de colunas">
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ["externalId", "ID da transação"],
                ["date", "Data"],
                ["status", "Status"],
                ["saleAmount", "Valor da venda"],
                ["commission", "Comissão"],
                ["currency", "Moeda"],
                ["clickRef", "Sub-ID / referência do clique (opcional)"],
              ] as [keyof Mapping, string][]
            ).map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`m-${k}`}>
                <select id={`m-${k}`} className={inputCls} value={mapping[k]} onChange={(e) => (k === "status" ? setStatusColumn(e.target.value) : setMapping({ ...mapping, [k]: e.target.value }))}>
                  <option value="">—</option>
                  {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            ))}
          </div>
          {statuses.length > 0 && (
            <Field label="Correspondência de status">
              <div className="space-y-2">
                {statuses.map((s) => (
                  <div key={s} className="flex items-center gap-3 text-sm">
                    <span className="w-40 truncate font-mono">{s}</span>
                    <select aria-label={`Status ${s}`} className={sel} value={statusMap[s] ?? ""} onChange={(e) => setStatusMap({ ...statusMap, [s]: e.target.value as "pending" })}>
                      <option value="">—</option>
                      <option value="pending">Pendente</option>
                      <option value="confirmed">Confirmada</option>
                      <option value="rejected">Rejeitada</option>
                    </select>
                  </div>
                ))}
              </div>
            </Field>
          )}
        </FormSection>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={!file || pending} className={btnSecondary} onClick={() => run(() => importConversions(payload(false)), { onSuccess: (d) => setResult(d) })}>Pré-visualizar</button>
        <button type="button" disabled={!file || pending || !result || result.errors.length > 0 || result.committed || result.rows === 0} className={btnPrimary} onClick={() => run(() => importConversions(payload(true)), { success: "Conversões importadas.", onSuccess: (d) => setResult(d) })}>Importar</button>
      </div>
      {result && (
        <div className="panel p-5 text-sm" aria-live="polite">
          {result.committed ? <p className="font-medium">Importado: {result.inserted} nova(s), {result.updated} atualizada(s).</p> : <p className="font-medium">{result.rows} conversão(ões) prontas para importar.</p>}
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-64 overflow-y-auto font-mono text-xs">
              {result.errors.map((e, i) => <li key={i}>Linha {e.line}: {e.message}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
