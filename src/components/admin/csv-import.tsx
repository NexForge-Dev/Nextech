"use client";
import { useState } from "react";
import { Upload } from "lucide-react";
import { importProductsCsv, type ImportPreview } from "@/actions/admin/products";
import { btnPrimary, btnSecondary, useAdminAction } from "./form";

export function CsvImport({ columns }: { columns: readonly string[] }) {
  const { pending, run } = useAdminAction();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  async function onFile(f: File | undefined) {
    setPreview(null);
    if (!f) return setFile(null);
    if (f.size > 5_000_000) return alertMsg("Arquivo maior que 5 MB.");
    setFile({ name: f.name, text: await f.text() });
  }
  function alertMsg(m: string) {
    setPreview({ products: 0, offers: 0, errors: [{ line: 0, message: m }], created: 0, updated: 0, committed: false });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="rounded-md border border-line p-5 text-sm">
        <p className="font-medium">Formato</p>
        <p className="mt-1 text-mute">CSV com cabeçalho, uma linha por oferta. Linhas com o mesmo <code className="font-mono">slug</code> formam um produto. Preços com ponto decimal (199.90). Tags e imagens separadas por “|”. Categorias, marcas e lojas devem existir (use o slug).</p>
        <p className="mt-3 break-all font-mono text-xs">{columns.join(",")}</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler */}
        <a href="/admin/produtos/exportar" download className="mt-3 inline-block text-sm font-medium underline">Baixar exportação atual como modelo</a>
      </div>
      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-mute p-6 hover:bg-soft">
        <Upload className="size-5" aria-hidden />
        <span className="text-sm">{file ? file.name : "Escolher arquivo CSV"}</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <div className="flex gap-2">
        <button type="button" disabled={!file || pending} className={btnSecondary} onClick={() => file && run(() => importProductsCsv({ text: file.text, filename: file.name, commit: false }), { onSuccess: (d) => setPreview(d) })}>
          Pré-visualizar
        </button>
        <button
          type="button"
          disabled={!file || pending || !preview || preview.errors.length > 0 || preview.committed || preview.products === 0}
          className={btnPrimary}
          onClick={() => file && run(() => importProductsCsv({ text: file.text, filename: file.name, commit: true }), { success: "Importação concluída.", onSuccess: (d) => setPreview(d) })}
        >
          {pending ? "Processando…" : "Importar"}
        </button>
      </div>
      {preview && (
        <div className="rounded-md border border-line p-5 text-sm" aria-live="polite">
          {preview.committed ? (
            <p className="font-medium">Importado: {preview.created} produto(s) criado(s), {preview.updated} atualizado(s).</p>
          ) : (
            <p className="font-medium">Pré-visualização: {preview.products} produto(s) e {preview.offers} oferta(s) prontos para importar.</p>
          )}
          {preview.errors.length > 0 && (
            <>
              <p className="mt-3 font-medium">⚠ {preview.errors.length} erro(s) — corrija o arquivo e envie novamente:</p>
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto font-mono text-xs">
                {preview.errors.map((e, i) => (
                  <li key={i}>{e.line ? `Linha ${e.line}: ` : ""}{e.message}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
