import type { ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export type Column<T> = { key: string; header: string; className?: string; cell: (row: T) => ReactNode; sortKey?: string };

function qs(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Server-rendered table driven by URL params (q, page, sort, status). Scrolls horizontally on small screens. */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  total,
  page,
  pageSize,
  params,
  basePath,
  searchPlaceholder,
  filters,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  total: number;
  page: number;
  pageSize: number;
  params: Record<string, string | undefined>;
  basePath: string;
  searchPlaceholder?: string;
  filters?: ReactNode;
  empty: ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="space-y-4">
      {(searchPlaceholder || filters) && (
        <form method="get" action={basePath} className="flex flex-wrap items-center gap-2">
          {searchPlaceholder && (
            <div className="relative min-w-56 flex-1 md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" aria-hidden />
              <input name="q" defaultValue={params.q ?? ""} placeholder={searchPlaceholder} aria-label="Filtrar" className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-black" />
            </div>
          )}
          {filters}
          {params.sort && <input type="hidden" name="sort" value={params.sort} />}
          <button type="submit" className="h-10 cursor-pointer rounded-md border border-line px-4 text-sm font-medium hover:bg-soft">Filtrar</button>
        </form>
      )}
      {rows.length === 0 ? (
        empty
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line bg-soft text-left">
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-mute ${c.className ?? ""}`}>
                    {c.sortKey ? (
                      <Link href={`${basePath}${qs(params, { sort: params.sort === c.sortKey ? `-${c.sortKey}` : c.sortKey, page: undefined })}`} className="hover:text-black">
                        {c.header}
                        {params.sort === c.sortKey ? " ↑" : params.sort === `-${c.sortKey}` ? " ↓" : ""}
                      </Link>
                    ) : (
                      c.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-soft/60">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 align-middle ${c.className ?? ""}`}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="tabular text-mute">
            {total} registro(s) · página {page} de {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 && <Link href={`${basePath}${qs(params, { page: String(page - 1) })}`} className="rounded-md border border-line px-3 py-1.5 hover:bg-soft">Anterior</Link>}
            {page < pages && <Link href={`${basePath}${qs(params, { page: String(page + 1) })}`} className="rounded-md border border-line px-3 py-1.5 hover:bg-soft">Próxima</Link>}
          </div>
        </div>
      )}
    </div>
  );
}

export function EmptyPanel({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-line px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-mute">{text}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatusPill({ active, on = "Ativo", off = "Inativo" }: { active: boolean; on?: string; off?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${active ? "text-black" : "text-mute"}`}>
      <span className={`size-1.5 rounded-full ${active ? "bg-black" : "border border-mute"}`} aria-hidden />
      {active ? on : off}
    </span>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors duration-150 ${variant === "primary" ? "bg-black text-white hover:bg-ink" : "border border-line bg-white hover:bg-soft"}`}
    >
      {children}
    </Link>
  );
}
