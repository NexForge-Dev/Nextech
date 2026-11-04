"use client";
import { useState } from "react";
import { CircleAlert, ClipboardCopy, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { importProductsJson, type JsonImportPreview } from "@/actions/admin/products";
import { btnPrimary, btnSecondary, useAdminAction } from "./form";

export function JsonImport({ prompt }: { prompt: string }) {
  const { pending, run } = useAdminAction();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<JsonImportPreview | null>(null);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Modelo copiado. Cole no ChatGPT com os dados dos produtos.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto do modelo e copie manualmente.");
    }
  }

  const importable = preview && !preview.committed && preview.items.length > 0 && preview.errors.length === 0;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="panel p-5 text-sm">
        <p className="font-medium">1. Copie o modelo</p>
        <p className="mt-1 text-mute">Ele já leva as regras e as suas categorias, marcas e fornecedores. Cole no ChatGPT e acrescente os dados dos produtos no final.</p>
        <button type="button" onClick={copyPrompt} className={`${btnSecondary} mt-3`}>
          <ClipboardCopy className="size-4" aria-hidden /> Copiar modelo para o ChatGPT
        </button>
        <details className="mt-3">
          <summary className="cursor-pointer text-mute">Ver o modelo</summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-soft p-3 font-mono text-xs">{prompt}</pre>
        </details>
      </div>

      <div className="panel p-5 text-sm">
        <label htmlFor="json-answer" className="font-medium">2. Cole a resposta do ChatGPT</label>
        <textarea
          id="json-answer"
          rows={12}
          spellCheck={false}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
          }}
          className="mt-2 w-full rounded-md border border-line p-3 font-mono text-xs outline-none focus:border-black"
          placeholder='{ "produtos": [ … ] }'
        />
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={!text.trim() || pending} className={btnSecondary} onClick={() => run(() => importProductsJson({ text, commit: false }), { onSuccess: (d) => setPreview(d) })}>
            Pré-visualizar
          </button>
          <button type="button" disabled={!importable || pending} className={btnPrimary} onClick={() => run(() => importProductsJson({ text, commit: true }), { success: "Importação concluída.", onSuccess: (d) => setPreview(d) })}>
            {pending ? "Processando…" : "Importar"}
          </button>
        </div>
      </div>

      {preview && (
        <div className="panel p-5 text-sm" aria-live="polite">
          <p className="font-medium">{preview.committed ? `Importado: ${preview.created} produto(s) criado(s).` : `Pré-visualização: ${preview.items.length} produto(s) prontos para importar.`}</p>
          {preview.items.length > 0 && (
            <ul className="mt-2 space-y-1">
              {preview.items.map((item) => (
                <li key={item.slug}>
                  {preview.committed && item.id ? (
                    <a href={`/admin/produtos/${item.id}`} className="underline">{item.name}</a>
                  ) : (
                    item.name
                  )}
                  <span className="text-mute"> · {item.summary}</span>
                </li>
              ))}
            </ul>
          )}
          {preview.committed && preview.created > 0 && <p className="mt-3 text-mute">Abra cada produto para enviar as imagens e publicar.</p>}
          {preview.warnings.length > 0 && (
            <>
              <p className="mt-3 font-medium"><TriangleAlert className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />{preview.warnings.length} aviso(s):</p>
              <ul className="mt-2 space-y-1 text-xs">
                {preview.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </>
          )}
          {preview.errors.length > 0 && (
            <>
              <p className="mt-3 font-medium"><CircleAlert className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />{preview.errors.length} erro(s). Corrija e pré-visualize de novo:</p>
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto font-mono text-xs">
                {preview.errors.map((e, i) => <li key={i}>{e.message}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
