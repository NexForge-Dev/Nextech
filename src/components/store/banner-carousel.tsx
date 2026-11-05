"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { storagePublicUrl } from "@/lib/supabase/env";

export type CarouselBanner = { id: string; title: string; subtitle: string | null; imagePath: string; mobileImagePath: string | null; linkUrl: string | null };

/** A single, restrained banner carousel. `frame` forces a layout (used by the admin preview). */
export function BannerCarousel({ banners, labels, frame }: { banners: CarouselBanner[]; labels: { previous: string; next: string }; frame?: "desktop" | "mobile" }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = banners.length;
  // WCAG 2.2.2: pauses while hovered/focused and for reduced motion; manual navigation restarts the timer
  useEffect(() => {
    if (n < 2 || paused) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => setI((x) => (x + 1) % n), 7000);
    return () => clearTimeout(id);
  }, [n, paused, i]);
  if (!n) return null;
  const b = banners[Math.min(i, n - 1)];
  const mobile = frame === "mobile";
  const desktopSrc = storagePublicUrl("banners", b.imagePath);
  const mobileSrc = storagePublicUrl("banners", b.mobileImagePath ?? b.imagePath);
  const content = (
    <div className={`relative overflow-hidden rounded-md bg-soft ${mobile ? "aspect-[4/5]" : "aspect-[4/5] md:aspect-[21/8]"}`}>
      {frame !== "desktop" && mobileSrc && (
        <Image src={mobileSrc} alt="" fill sizes="100vw" className={`object-cover ${mobile ? "" : "md:hidden"}`} unoptimized={mobileSrc.endsWith(".svg")} />
      )}
      {!mobile && desktopSrc && (
        <Image src={desktopSrc} alt="" fill sizes="100vw" className={`object-cover ${frame === "desktop" ? "" : "hidden md:block"}`} priority unoptimized={desktopSrc.endsWith(".svg")} />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
        <p className={`max-w-2xl font-semibold tracking-tight text-white ${mobile ? "text-2xl" : "text-2xl md:text-4xl"}`}>{b.title}</p>
        {b.subtitle && <p className="mt-2 max-w-xl text-sm text-white/85 md:text-base">{b.subtitle}</p>}
      </div>
    </div>
  );
  return (
    <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {b.linkUrl ? (
        <a href={b.linkUrl} className="block" {...(b.linkUrl.startsWith("https://") ? { rel: "noopener", target: "_blank" } : {})}>
          {content}
        </a>
      ) : (
        content
      )}
      {n > 1 && (
        <div className="absolute right-4 top-4 flex gap-2">
          <button type="button" aria-label={labels.previous} onClick={() => setI((x) => (x - 1 + n) % n)} className="grid size-11 md:size-9 cursor-pointer place-items-center rounded-full bg-white/90 text-black hover:bg-white">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button type="button" aria-label={labels.next} onClick={() => setI((x) => (x + 1) % n)} className="grid size-11 md:size-9 cursor-pointer place-items-center rounded-full bg-white/90 text-black hover:bg-white">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
