import Link from "next/link";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyPanel } from "@/components/admin/data-table";
import { MessageActions } from "@/components/admin/people-forms";

export const metadata = { title: "Mensagens de contato" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await pageGuard("customers.read");
  const { all } = await searchParams;
  const sb = await createServerSupabase();
  let q = sb.from("contact_messages").select("id, name, email, subject, body, locale, handled, created_at").order("created_at", { ascending: false }).limit(200);
  if (all !== "1") q = q.eq("handled", false);
  const { data } = await q;
  return (
    <>
      <PageHeader
        title="Mensagens de contato"
        description="Enviadas pelo formulário de contato da loja."
        actions={<Link href={all === "1" ? "/admin/clientes/mensagens" : "/admin/clientes/mensagens?all=1"} className="inline-flex h-10 items-center rounded-md border border-line px-4 text-sm font-medium hover:bg-soft">{all === "1" ? "Somente pendentes" : "Ver todas"}</Link>}
      />
      {!data?.length ? (
        <EmptyPanel title={all === "1" ? "Nenhuma mensagem" : "Nenhuma mensagem pendente"} />
      ) : (
        <ul className="space-y-3">
          {data.map((m) => (
            <li key={m.id} className={`rounded-md border p-5 ${m.handled ? "border-line" : "border-black"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{m.subject || "(sem assunto)"}</p>
                  <p className="text-sm text-mute">
                    {m.name} · <a href={`mailto:${m.email}`} className="underline">{m.email}</a> · {m.locale} · {new Date(m.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <MessageActions id={m.id} handled={m.handled} />
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
