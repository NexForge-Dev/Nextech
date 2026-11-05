import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { FEEDBACK_LIST_LIMIT, listFeedback } from "@/lib/data/admin/feedback";
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, type FeedbackKind, type FeedbackStatus } from "@/lib/domain/feedback";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyPanel } from "@/components/admin/data-table";
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL } from "@/components/admin/feedback-labels";
import { FeedbackStatusSelect } from "@/components/admin/feedback-status";

export const metadata = { title: "Sugestões e problemas" };

const pick = <T extends string>(list: readonly T[], value: string | undefined): T | undefined => list.find((x) => x === value);

function href(status?: FeedbackStatus, kind?: FeedbackKind) {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (kind) q.set("kind", kind);
  const s = q.toString();
  return s ? `/admin/feedback?${s}` : "/admin/feedback";
}

function Filter({ label, options }: { label: string; options: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-mute">{label}:</span>
      {options.map((o) => (
        <Link key={o.href} href={o.href} aria-current={o.active ? "true" : undefined} className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium ${o.active ? "border-black bg-black text-white" : "border-line hover:bg-soft"}`}>
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ status?: string; kind?: string }> }) {
  await pageGuard("customers.read");
  const sp = await searchParams;
  const status = pick(FEEDBACK_STATUSES, sp.status);
  const kind = pick(FEEDBACK_KINDS, sp.kind);
  const items = await listFeedback({ status, kind });
  return (
    <>
      <PageHeader title="Sugestões e problemas" description={`Enviados pelo balão da loja por clientes com login. Mostra as ${FEEDBACK_LIST_LIMIT} mensagens mais recentes.`} />
      <div className="mb-5 space-y-3">
        <Filter
          label="Status"
          options={[
            { label: "Todos", href: href(undefined, kind), active: !status },
            ...FEEDBACK_STATUSES.map((s) => ({ label: FEEDBACK_STATUS_LABEL[s], href: href(s, kind), active: status === s })),
          ]}
        />
        <Filter
          label="Tipo"
          options={[
            { label: "Todos", href: href(status), active: !kind },
            ...FEEDBACK_KINDS.map((k) => ({ label: FEEDBACK_KIND_LABEL[k], href: href(status, k), active: kind === k })),
          ]}
        />
      </div>
      {!items.length ? (
        <EmptyPanel title="Nenhuma mensagem" />
      ) : (
        <ul className="space-y-3">
          {items.map((f) => (
            <li key={f.id} className={`rounded-md border p-5 ${f.status === "new" ? "border-black" : "border-line"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{FEEDBACK_KIND_LABEL[f.kind]}</p>
                  <p className="text-sm text-mute">
                    {f.email ? <a href={`mailto:${f.email}`} className="underline">{f.email}</a> : "E-mail indisponível"} · {f.page || "página não informada"} · {new Date(f.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </p>
                </div>
                <FeedbackStatusSelect id={f.id} status={f.status} />
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink">{f.message}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
