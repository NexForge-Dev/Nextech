import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";

export type Column<T> = { key: string; header: string; className?: string; cell: (row: T) => ReactNode; sortKey?: string };

function qs(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Server-rendered table driven by URL params (q, page, sort, status). On phones rows stack, labelled per cell. */
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
    <div className="space-y-3">
      {(searchPlaceholder || filters) && (
        <form method="get" action={basePath} className="panel flex flex-wrap items-center gap-2 p-3 max-md:[&_select]:w-full">
          {searchPlaceholder && (
            <div className="relative min-w-56 flex-1 md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" aria-hidden />
              <input name="q" defaultValue={params.q ?? ""} placeholder={searchPlaceholder} aria-label="Filtrar" className="field h-10 pl-9" />
            </div>
          )}
          {filters}
          {params.sort && <input type="hidden" name="sort" value={params.sort} />}
          <button type="submit" className="btn btn-secondary">Filtrar</button>
        </form>
      )}
      {rows.length === 0 ? (
        empty
      ) : (
        <div className="panel relative overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela">
          <table className="table-stack w-full text-sm md:min-w-[720px]">
            <thead>
              <tr className="border-b border-line bg-soft text-left">
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={`whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-mute ${c.className ?? ""}`}>
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
                <tr key={r.id} className="border-b border-line transition-colors duration-150 last:border-0 hover:bg-soft/60">
                  {columns.map((c) => (
                    <td key={c.key} data-label={c.header} className={`px-4 py-3 align-middle max-md:[overflow-wrap:anywhere] ${c.className ?? ""}`}>
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
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="tabular text-mute">
            {total} registro(s) · página {page} de {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 && <Link href={`${basePath}${qs(params, { page: String(page - 1) })}`} className="btn btn-secondary btn-sm"><ChevronLeft aria-hidden />Anterior</Link>}
            {page < pages && <Link href={`${basePath}${qs(params, { page: String(page + 1) })}`} className="btn btn-secondary btn-sm">Próxima<ChevronRight aria-hidden /></Link>}
          </div>
        </div>
      )}
    </div>
  );
}

export function EmptyPanel({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-soft"><Inbox className="size-5" strokeWidth={1.75} aria-hidden /></span>
      <p className="font-semibold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-mute">{text}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatusPill({ active, on = "Ativo", off = "Inativo" }: { active: boolean; on?: string; off?: string }) {
  return (
    <span className={`tag ${active ? "" : "tag-soft"}`}>
      <span className={`size-1.5 rounded-full ${active ? "bg-black" : "border border-mute"}`} aria-hidden />
      {active ? on : off}
    </span>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link
      href={href}
      className={`btn ${variant === "primary" ? "btn-primary" : "btn-secondary"}`}
    >
      {children}
    </Link>
  );
}
