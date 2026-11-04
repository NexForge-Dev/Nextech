"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Img = { src: string; alt: string };

export function Gallery({ images, name }: { images: Img[]; name: string }) {
  const t = useTranslations("product");
  const tc = useTranslations("common");
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = images.length;

  if (!n) {
    return <div className="panel grid aspect-square place-items-center bg-soft text-sm text-mute">{t("noImage")}</div>;
  }
  const current = images[i];
  const prev = () => setI((x) => (x - 1 + n) % n);
  const next = () => setI((x) => (x + 1) % n);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  };

  return (
    <div className="min-w-0 space-y-3" onKeyDown={onKey}>
      <div
        className="panel group relative aspect-square overflow-hidden lg:aspect-[5/4]"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) (dx > 0 ? prev : next)();
          touchX.current = null;
        }}
      >
        <button type="button" onClick={() => setZoom(true)} className="absolute inset-0 cursor-zoom-in" aria-label={t("zoom")}>
          <Image src={current.src} alt={current.alt || name} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain p-6 md:p-10" unoptimized={current.src.endsWith(".svg")} />
        </button>
        <span className="pointer-events-none absolute bottom-3 right-3 grid size-9 place-items-center rounded-full border border-line bg-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <ZoomIn className="size-4" aria-hidden />
        </span>
        {n > 1 && (
          <>
            <button type="button" onClick={prev} aria-label={t("previousImage")} className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-line bg-white transition-colors duration-150 hover:border-black">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={next} aria-label={t("nextImage")} className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-line bg-white transition-colors duration-150 hover:border-black">
              <ChevronRight className="size-4" aria-hidden />
            </button>
            <p className="tabular absolute bottom-3 left-3 rounded-sm bg-soft px-2 py-0.5 text-xs" aria-live="polite">
              {t("image", { n: i + 1, total: n })}
            </p>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              type="button"
              key={img.src}
              onClick={() => setI(idx)}
              aria-label={t("image", { n: idx + 1, total: n })}
              aria-current={idx === i}
              className={`relative size-16 shrink-0 cursor-pointer overflow-hidden rounded-md border bg-white transition-colors duration-150 md:size-20 ${idx === i ? "border-black ring-1 ring-black" : "border-line hover:border-mute"}`}
            >
              <Image src={img.src} alt="" fill sizes="80px" className="object-contain p-1.5" unoptimized={img.src.endsWith(".svg")} />
            </button>
          ))}
        </div>
      )}
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent closeLabel={tc("close")} className="max-w-[min(92vw,1100px)] rounded-md border-0 bg-white p-0 shadow-none ring-0 sm:max-w-[min(92vw,1100px)]" onKeyDown={(e) => { onKey(e); e.stopPropagation(); /* React bubbles through the portal to the outer handler */ }}>
          <DialogTitle className="sr-only">{name}</DialogTitle>
          <div className="relative aspect-square max-h-[85vh] w-full">
            <Image src={current.src} alt={current.alt || name} fill sizes="92vw" className="object-contain p-6" unoptimized={current.src.endsWith(".svg")} />
          </div>
          {n > 1 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3">
              <button type="button" onClick={prev} className="inline-flex cursor-pointer items-center gap-1 text-sm hover:underline">
                <ChevronLeft className="size-4" aria-hidden /> {t("previousImage")}
              </button>
              <span className="tabular text-xs text-mute">{t("image", { n: i + 1, total: n })}</span>
              <button type="button" onClick={next} className="inline-flex cursor-pointer items-center gap-1 text-sm hover:underline">
                {t("nextImage")} <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
