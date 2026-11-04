import { ProductGridSkeleton } from "@/components/store/ui";

export default function Loading() {
  return (
    <main aria-busy="true">
      <div className="border-b border-line bg-soft">
        <div className="shell py-6 md:py-8">
          <div className="h-3 w-24 animate-pulse rounded bg-line" />
          <div className="mt-3 h-8 w-56 animate-pulse rounded-md bg-line" />
        </div>
      </div>
      <div className="shell grid gap-6 pb-16 pt-6 lg:grid-cols-[256px_minmax(0,1fr)] lg:gap-8 lg:pt-8">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-soft" />)}
        </div>
        <ProductGridSkeleton />
      </div>
    </main>
  );
}
