export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 md:px-6" aria-busy="true">
      <div className="mb-8 h-10 w-56 animate-pulse rounded-md bg-soft" />
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-soft" />)}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-square animate-pulse rounded-md bg-soft" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-soft" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-soft" />
              <div className="h-5 w-1/2 animate-pulse rounded bg-soft" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
