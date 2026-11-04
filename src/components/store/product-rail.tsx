"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Horizontal shelf for the home: swipe on touch, arrows on larger screens when there is more to see. */
export function ProductRail({ children, labels }: { children: ReactNode; labels: { previous: string; next: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ prev: false, next: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ prev: el.scrollLeft > 4, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  const move = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  const arrow = "absolute top-[38%] z-10 hidden size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-line bg-white shadow-[var(--shadow-card)] transition-colors duration-150 hover:border-black md:grid";
  return (
    <div className="relative">
      <div ref={ref} className="rail -mx-4 px-4 md:mx-0 md:px-0 [&>*]:w-[46%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[31%] lg:[&>*]:w-[calc((100%-3rem)/4)] xl:[&>*]:w-[calc((100%-4rem)/5)]">
        {children}
      </div>
      {edges.prev && (
        <button type="button" aria-label={labels.previous} onClick={() => move(-1)} className={`${arrow} -left-3`}>
          <ChevronLeft className="size-4" aria-hidden />
        </button>
      )}
      {edges.next && (
        <button type="button" aria-label={labels.next} onClick={() => move(1)} className={`${arrow} -right-3`}>
          <ChevronRight className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
