import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { parsePeriod } from "@/lib/domain/period";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, EmptyPanel } from "@/components/admin/data-table";

export const metadata = { title: "Log de auditoria" };

const PAGE = 50;

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ entity?: string; actor?: string; p?: string; page?: string }> }) {
  await pageGuard("audit.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const period = parsePeriod(new URLSearchParams({ p: sp.p ?? "90d" }));
  const sb = await createServerSupabase();
  let q = sb.from("admin_audit_log").select("id, actor_id, action, entity, entity_id, summary, occurred_at", { count: "exact" }).gte("occurred_at", period.from.toISOString()).order("occurred_at", { ascending: false });
  if (sp.entity) q = q.eq("entity", sp.entity);
  if (sp.actor && /^[0-9a-f-]{36}$/i.test(sp.actor)) q = q.eq("actor_id", sp.actor);
  const [{ data, count }, users] = await Promise.all([q.range((page - 1) * PAGE, page * PAGE - 1), createServiceSupabase().auth.admin.listUsers({ perPage: 1000 })]);
  const email = new Map((users.data?.users ?? []).map((u) => [u.id, u.email ?? u.id]));
  const entities = ["products", "categories", "brands", "stores", "affiliate_networks", "promotions", "banners", "campaigns", "site_settings", "admin_users", "contact_messages", "product_feedback", "reports", "customers"];
  const sel = "field h-10 w-auto";
  return (
    <>
      <PageHeader title="Log de auditoria" description="Quem fez o quê e quando. Valores sensíveis aparecem como [redacted]." />
      <DataTable
        rows={data ?? []}
        total={count ?? 0}
        page={page}
        pageSize={PAGE}
        params={{ entity: sp.entity, actor: sp.actor, p: sp.p }}
        basePath="/admin/configuracoes/logs"
        filters={
          <>
            <select name="entity" defaultValue={sp.entity ?? ""} aria-label="Entidade" className={sel}>
              <option value="">Todas as entidades</option>
              {entities.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <select name="p" defaultValue={sp.p ?? "90d"} aria-label="Período" className={sel}>
              <option value="7d">7 dias</option>
              <option value="30d">30 dias</option>
              <option value="90d">90 dias</option>
            </select>
          </>
        }
        empty={<EmptyPanel title="Nenhum registro no período" />}
        columns={[
          { key: "when", header: "Quando", cell: (r) => <span className="tabular text-xs">{new Date(r.occurred_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span> },
          { key: "who", header: "Quem", cell: (r) => <span className="text-xs">{r.actor_id ? email.get(r.actor_id) ?? r.actor_id : "Sistema"}</span> },
          { key: "what", header: "Ação", cell: (r) => <span className="font-mono text-xs">{r.entity}.{r.action}</span> },
          { key: "id", header: "Registro", cell: (r) => <span className="font-mono text-xs text-mute">{r.entity_id?.slice(0, 12) ?? "—"}</span> },
          { key: "summary", header: "Resumo", cell: (r) => <code className="block max-w-md truncate font-mono text-xs text-mute" title={JSON.stringify(r.summary)}>{JSON.stringify(r.summary)}</code> },
        ]}
      />
    </>
  );
}
