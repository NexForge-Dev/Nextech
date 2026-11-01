import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import type { Period } from "@/lib/domain/period";
import { getMetrics, type MetricFilters } from "@/lib/data/admin/metrics";

type Row = Record<string, string | number | null>;
type Report = { title: string; description: string; columns: { key: string; header: string }[]; load: (p: Period, f: MetricFilters) => Promise<Row[]> };

const dt = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
const MAX = 100_000;

export const REPORTS: Record<string, Report> = {
  clicks: {
    title: "Cliques nos links afiliados",
    description: "Um registro por clique (sem robôs), com produto, loja, rede, campanha, país e idioma.",
    columns: [
      { key: "date", header: "Data" }, { key: "product", header: "Produto" }, { key: "store", header: "Loja" }, { key: "network", header: "Rede" },
      { key: "campaign", header: "Campanha" }, { key: "market", header: "País" }, { key: "locale", header: "Idioma" },
    ],
    async load(p, f) {
      const sb = await createServerSupabase();
      let q = sb.from("affiliate_clicks").select("occurred_at, market, locale, products(product_translations(locale, name)), stores(name), affiliate_networks(name), campaigns(name)").eq("is_bot", false).gte("occurred_at", p.from.toISOString()).lte("occurred_at", p.to.toISOString()).order("occurred_at").limit(MAX);
      if (f.product) q = q.eq("product_id", f.product);
      if (f.campaign) q = q.eq("campaign_id", f.campaign);
      if (f.network) q = q.eq("network_id", f.network);
      const { data } = await q;
      return (data ?? []).map((c) => ({ date: dt(c.occurred_at), product: c.products?.product_translations.find((t) => t.locale === "pt-BR")?.name ?? "", store: c.stores?.name ?? "", network: c.affiliate_networks?.name ?? "", campaign: c.campaigns?.name ?? "", market: c.market, locale: c.locale }));
    },
  },
  views: {
    title: "Visualizações por dia",
    description: "Visualizações de páginas de produto e cliques por dia.",
    columns: [{ key: "day", header: "Dia" }, { key: "views", header: "Visualizações" }, { key: "clicks", header: "Cliques" }],
    async load(p, f) {
      const m = await getMetrics(p, f);
      return m.viewsByDay.map((v, i) => ({ day: v.key, views: v.value, clicks: m.clicksByDay[i]?.value ?? 0 }));
    },
  },
  "products-performance": {
    title: "Desempenho por produto",
    description: "Visualizações, cliques e taxa de cliques dos produtos com atividade no período.",
    columns: [{ key: "product", header: "Produto" }, { key: "views", header: "Visualizações" }, { key: "clicks", header: "Cliques" }, { key: "ctr", header: "Taxa de cliques (%)" }],
    async load(p, f) {
      const m = await getMetrics(p, f);
      return m.topProducts.map((r) => ({ product: r.name, views: r.views, clicks: r.clicks, ctr: r.ctr != null ? (r.ctr * 100).toFixed(2).replace(".", ",") : "" }));
    },
  },
  conversions: {
    title: "Conversões reportadas",
    description: "Conversões recebidas das redes (API ou relatório), com status e valor da venda.",
    columns: [{ key: "date", header: "Data" }, { key: "network", header: "Rede" }, { key: "external", header: "ID externo" }, { key: "product", header: "Produto" }, { key: "status", header: "Status" }, { key: "sale", header: "Valor da venda" }, { key: "source", header: "Fonte" }],
    async load(p, f) {
      const sb = await createServerSupabase();
      let q = sb.from("affiliate_conversions").select("occurred_at, external_id, status, sale_amount_minor, currency, source, affiliate_networks(name), products(product_translations(locale, name))").gte("occurred_at", p.from.toISOString()).lte("occurred_at", p.to.toISOString()).order("occurred_at").limit(MAX);
      if (f.network) q = q.eq("network_id", f.network);
      if (f.product) q = q.eq("product_id", f.product);
      if (f.campaign) q = q.eq("campaign_id", f.campaign);
      const { data } = await q;
      return (data ?? []).map((c) => ({ date: dt(c.occurred_at), network: c.affiliate_networks?.name ?? "", external: c.external_id, product: c.products?.product_translations.find((t) => t.locale === "pt-BR")?.name ?? "", status: c.status, sale: c.sale_amount_minor != null && c.currency ? formatMoney(c.sale_amount_minor, c.currency, "pt-BR") : "", source: c.source }));
    },
  },
  commissions: {
    title: "Comissões",
    description: "Comissões por status e moeda, como reportadas pelas redes. Nenhuma conversão de moeda.",
    columns: [{ key: "date", header: "Data" }, { key: "network", header: "Rede" }, { key: "external", header: "ID externo" }, { key: "status", header: "Status" }, { key: "currency", header: "Moeda" }, { key: "amount", header: "Valor" }, { key: "source", header: "Fonte" }],
    async load(p, f) {
      const sb = await createServerSupabase();
      let q = sb.from("affiliate_commissions").select("reported_at, external_id, status, currency, amount_minor, source, affiliate_networks(name)").gte("reported_at", p.from.toISOString()).lte("reported_at", p.to.toISOString()).order("reported_at").limit(MAX);
      if (f.network) q = q.eq("network_id", f.network);
      const { data } = await q;
      return (data ?? []).map((c) => ({ date: dt(c.reported_at), network: c.affiliate_networks?.name ?? "", external: c.external_id, status: c.status, currency: c.currency, amount: formatMoney(c.amount_minor, c.currency, "pt-BR"), source: c.source }));
    },
  },
  searches: {
    title: "Buscas",
    description: "Termos pesquisados na loja e quantidade de resultados.",
    columns: [{ key: "date", header: "Data" }, { key: "query", header: "Busca" }, { key: "locale", header: "Idioma" }, { key: "results", header: "Resultados" }],
    async load(p) {
      const sb = await createServerSupabase();
      const { data } = await sb.from("searches").select("occurred_at, query, locale, results").gte("occurred_at", p.from.toISOString()).lte("occurred_at", p.to.toISOString()).order("occurred_at").limit(MAX);
      return (data ?? []).map((s) => ({ date: dt(s.occurred_at), query: s.query, locale: s.locale, results: s.results }));
    },
  },
};
