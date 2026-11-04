import type { ComponentType, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";

type Icon = ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;

/** Icon-led placeholder for empty lists, load failures and "nothing here yet". */
export function EmptyState({ icon: Icon, title, text, children, role }: { icon?: Icon; title: string; text?: string; children?: ReactNode; role?: "alert" }) {
  return (
    <div role={role} className="panel flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 grid size-12 place-items-center rounded-full bg-soft">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
      )}
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-mute">{text}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

const NOTICE = {
  error: { Icon: CircleAlert, cls: "border border-black bg-white font-medium", role: "alert" },
  success: { Icon: CircleCheck, cls: "bg-soft", role: "status" },
  info: { Icon: Info, cls: "bg-soft", role: "status" },
} as const;

/** Inline message. Tone is carried by icon, border and weight, never by colour. */
export function Notice({ tone = "info", children, className = "", ...rest }: { tone?: keyof typeof NOTICE; children: ReactNode; className?: string; "data-testid"?: string }) {
  const { Icon, cls, role } = NOTICE[tone];
  return (
    <div role={role} className={`flex items-start gap-2.5 rounded-md px-3.5 py-3 text-sm ${cls} ${className}`} {...rest}>
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Label/value row used by cart, checkout and order summaries. */
export function SummaryRow({ label, children, strong = false }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "text-lg font-semibold tracking-tight" : "text-sm text-ink"}`}>
      <span>{label}</span>
      <span className="tabular shrink-0">{children}</span>
    </div>
  );
}

/** Skeleton of a product grid, shared by loading states. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel overflow-hidden">
          <div className="aspect-square animate-pulse bg-soft" />
          <div className="space-y-2 p-3 md:p-4">
            <div className="h-3 w-1/3 animate-pulse rounded bg-soft" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-soft" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-soft" />
          </div>
        </div>
      ))}
    </div>
  );
}
