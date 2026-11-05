"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SWIPE_PX = 50;

/**
 * Rotates the highlighted products at the top of the home. Every slide stays rendered in the same grid
 * cell, so the page keeps the height of the tallest one and doesn't jump between products.
 */
export function FlagshipCarousel({ slides, labels }: { slides: ReactNode[]; labels: { region: string; previous: string; next: string; goTo: string[] } }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const n = slides.length;
  const move = (d: -1 | 1) => setActive((x) => (x + d + n) % n);

  // WCAG 2.2.2: pauses while hovered/focused and for reduced motion; manual navigation restarts the timer
  useEffect(() => {
    if (paused) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => setActive((x) => (x + 1) % n), 7000);
    return () => clearTimeout(id);
  }, [n, paused, active]);

  return (
    <section
      data-testid="flagship-hero"
      aria-roledescription="carousel"
      aria-label={labels.region}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStart.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        const end = e.changedTouches[0]?.clientX;
        touchStart.current = null;
        if (start == null || end == null || Math.abs(end - start) < SWIPE_PX) return;
        move(end < start ? 1 : -1);
      }}
    >
      <div className="grid grid-cols-1">
        {slides.map((slide, i) => (
          <div
            key={i}
            data-testid="flagship-slide"
            data-active={i === active}
            aria-hidden={i !== active}
            inert={i !== active}
            className={`min-w-0 [grid-area:1/1] transition-opacity duration-300 ${i === active ? "opacity-100" : "invisible opacity-0"}`}
          >
            {slide}
          </div>
        ))}
      </div>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-1 px-4 pb-10 md:gap-4 md:px-6">
        <button type="button" aria-label={labels.previous} onClick={() => move(-1)} className="grid size-11 cursor-pointer md:size-9 place-items-center rounded-full border border-line bg-white text-black hover:bg-soft">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <div className="flex items-center">
          {slides.map((_, i) => (
            <button key={i} type="button" aria-label={labels.goTo[i]} aria-current={i === active} onClick={() => setActive(i)} className="grid size-11 cursor-pointer place-items-center md:size-6">
              <span className={`size-2 rounded-full ${i === active ? "bg-black" : "bg-line"}`} />
            </button>
          ))}
        </div>
        <button type="button" aria-label={labels.next} onClick={() => move(1)} className="grid size-11 cursor-pointer md:size-9 place-items-center rounded-full border border-line bg-white text-black hover:bg-soft">
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
