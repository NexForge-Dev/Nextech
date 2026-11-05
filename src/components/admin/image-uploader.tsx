"use client";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { storagePublicUrl } from "@/lib/supabase/env";

export type ImageItem = { path: string; alt: string; isMain: boolean };

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX = 5 * 1024 * 1024;

/** Upload to Supabase Storage (RLS-protected by admin permission), preview, reorder, pick the main image. */
export function ImageUploader({ bucket, value, onChange, multiple = true, label = "Enviar imagens" }: { bucket: string; value: ImageItem[]; onChange: (v: ImageItem[]) => void; multiple?: boolean; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const sb = createBrowserSupabase();
    const added: ImageItem[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPT.includes(file.type)) {
        toast.error(`${file.name}: formato não suportado (use JPG, PNG, WebP ou AVIF).`);
        continue;
      }
      if (file.size > MAX) {
        toast.error(`${file.name}: arquivo maior que 5 MB.`);
        continue;
      }
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        toast.error(`${file.name}: não foi possível enviar (${error.message}).`);
        continue;
      }
      added.push({ path, alt: "", isMain: false });
    }
    let next = multiple ? [...value, ...added] : added.slice(0, 1);
    if (next.length && !next.some((i) => i.isMain)) next = next.map((i, idx) => ({ ...i, isMain: idx === 0 }));
    onChange(next);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  function move(i: number, d: -1 | 1) {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {value.map((img, i) => {
            const src = storagePublicUrl(bucket, img.path) ?? "";
            return (
              <li key={img.path} className={`rounded-md border p-2 ${img.isMain ? "border-black" : "border-line"}`}>
                <div className="relative aspect-square overflow-hidden rounded bg-soft">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={img.alt} className="h-full w-full object-contain" />
                  {img.isMain && <span className="absolute left-1.5 top-1.5 rounded-sm bg-black px-1.5 py-0.5 text-[10px] font-semibold text-white">Principal</span>}
                </div>
                <input value={img.alt} onChange={(e) => onChange(value.map((x, idx) => (idx === i ? { ...x, alt: e.target.value.slice(0, 200) } : x)))} placeholder="Texto alternativo" aria-label="Texto alternativo" className="mt-2 h-8 w-full rounded border border-line px-2 text-base md:text-xs outline-none focus:border-black" />
                <div className="mt-2 flex justify-between">
                  <div className="flex gap-1">
                    {multiple && (
                      <>
                        <button type="button" onClick={() => move(i, -1)} aria-label="Mover para a esquerda" className="grid size-7 cursor-pointer place-items-center rounded hover:bg-soft"><ArrowUp className="size-3.5 -rotate-90" /></button>
                        <button type="button" onClick={() => move(i, 1)} aria-label="Mover para a direita" className="grid size-7 cursor-pointer place-items-center rounded hover:bg-soft"><ArrowDown className="size-3.5 -rotate-90" /></button>
                      </>
                    )}
                    {multiple && !img.isMain && (
                      <button type="button" onClick={() => onChange(value.map((x, idx) => ({ ...x, isMain: idx === i })))} aria-label="Definir como principal" className="grid size-7 cursor-pointer place-items-center rounded hover:bg-soft"><Star className="size-3.5" /></button>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Remover imagem"
                    onClick={() => {
                      let next = value.filter((_, idx) => idx !== i);
                      if (img.isMain && next.length) next = next.map((x, idx) => ({ ...x, isMain: idx === 0 }));
                      onChange(next);
                    }}
                    className="grid size-7 cursor-pointer place-items-center rounded hover:bg-soft"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <input ref={input} type="file" accept={ACCEPT.join(",")} multiple={multiple} className="hidden" onChange={(e) => upload(e.target.files)} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-mute px-4 text-sm font-medium hover:bg-soft disabled:opacity-60">
        <ImagePlus className="size-4" aria-hidden /> {busy ? "Enviando…" : label}
      </button>
      <p className="text-xs text-mute">JPG, PNG, WebP ou AVIF até 5 MB.</p>
    </div>
  );
}
