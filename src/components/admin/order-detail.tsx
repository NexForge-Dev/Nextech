"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";
import { adminFileUrl, attachInvoice, refundOrder, resolveReturn, updateOrderItem, updateOrderStatus } from "@/actions/admin/orders";
import { ADMIN_STATUS_LABEL, ORDER_STATUSES, adminCanSetStatus } from "@/lib/domain/order-status";
import { formatMoney } from "@/lib/domain/money";
import type { AdminOrderDetail } from "@/lib/data/admin/orders";
import { btnPrimary, btnSecondary, ConfirmButton, Field, FormSection, inputCls, textareaCls, Toggle, useAdminAction } from "./form";

type Order = NonNullable<AdminOrderDetail>;
const money = (m: number | null | undefined) => (m == null ? "—" : formatMoney(m, "BRL", "pt-BR"));
const toInput = (m: number | null) => (m == null ? "" : (m / 100).toFixed(2).replace(".", ","));
const maskCpf = (c: string) => (c && c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : "—");
const METHOD: Record<string, string> = { card: "Cartão", boleto: "Boleto", pix: "Pix" };
const EVENT: Record<string, string> = {
  created: "Pedido criado",
  boleto_issued: "Boleto gerado",
  paid: "Pagamento confirmado (Stripe)",
  payment_failed: "Pagamento recusado",
  cancelled: "Pedido cancelado",
  supplier_purchase: "Compra registrada no fornecedor",
  item_updated: "Item atualizado",
  status_changed: "Status alterado",
  shipped: "Pedido enviado",
  delivered: "Pedido entregue",
  refund_partial: "Reembolso parcial",
  refunded: "Reembolso total",
  refund_failed: "Falha ao reembolsar — reembolse manualmente",
  manual_refund_pending: "Reembolso por fora pendente (boleto)",
  refund_mismatch: "Reembolso do Stripe maior que o saldo do pedido — confira",
  return_requested: "Cliente abriu devolução/suporte",
  return_resolved: "Devolução/suporte resolvido",
  invoice_attached: "Nota fiscal anexada",
  email_sent: "E-mail enviado",
  email_skipped: "E-mail não enviado (provedor não configurado)",
  dispute_created: "Contestação aberta",
  dispute_closed: "Contestação encerrada",
};

export function AdminOrderView({ order, canWrite, canRefund }: { order: Order; canWrite: boolean; canRefund: boolean }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [status, setStatus] = useState(order.status);
  const [refund, setRefund] = useState({ amount: toInput(order.totalMinor - order.refundedMinor), note: "", manual: order.paymentMethod === "boleto" });
  const s = order.shipping;
  const addressText = `${s.recipientName}\n${s.street}, ${s.number}${s.complement ? ` – ${s.complement}` : ""}\n${s.district} · ${s.city}/${s.state}\nCEP ${s.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}\nTel. ${order.customer.phone}`;
  const paid = !!order.paidAt;
  const refundable = paid ? order.totalMinor - order.refundedMinor : 0;

  return (
    <div className="max-w-6xl space-y-2">
      <FormSection title="Cliente e entrega">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{order.customer.name}</p>
            <p>{order.customer.email}</p>
            <p>{order.customer.phone}</p>
            <p className="text-mute">CPF {maskCpf(order.customer.cpf)}</p>
          </div>
          <div className="text-sm">
            <p className="whitespace-pre-line" data-testid="ship-address">{addressText}</p>
            <button type="button" className={`${btnSecondary} mt-3`} onClick={() => navigator.clipboard?.writeText(`${addressText}\nCPF ${order.customer.cpf}`).then(() => toast.success("Endereço copiado"))}>
              <Copy className="size-4" /> Copiar endereço
            </button>
          </div>
        </div>
      </FormSection>

      <FormSection title="Itens e compra no fornecedor" description="Compre cada item no fornecedor com o endereço do cliente e registre aqui. O cliente nunca vê o fornecedor.">
        <div className="space-y-4">
          {order.items.map((i) => (
            <ItemForm key={`${i.id}:${i.trackingCode ?? ""}:${i.purchasedAt ?? ""}:${i.supplierCostMinor ?? ""}:${i.supplierId ?? ""}`} item={i} suppliers={order.suppliers} canWrite={canWrite} onSaved={() => router.refresh()} />
          ))}
        </div>
      </FormSection>

      <FormSection title="Valores">
        <table className="w-full max-w-md text-sm" data-testid="money-block">
          <tbody>
            <tr><td className="py-1">Recebido</td><td className="tabular py-1 text-right">{paid ? money(order.totalMinor) : "Aguardando pagamento"}</td></tr>
            {order.refundedMinor > 0 && <tr><td className="py-1">Reembolsado</td><td className="tabular py-1 text-right">− {money(order.refundedMinor)}</td></tr>}
            <tr><td className="py-1">Taxa Stripe</td><td className="tabular py-1 text-right">{order.stripeFeeMinor != null ? `− ${money(order.stripeFeeMinor)}` : "—"}</td></tr>
            <tr><td className="py-1">Custo fornecedor</td><td className="tabular py-1 text-right">{order.costMinor != null ? `− ${money(order.costMinor)}` : "registre o custo de todos os itens"}</td></tr>
            <tr className="border-t border-line font-semibold"><td className="py-2">Margem bruta</td><td className="tabular py-2 text-right" data-testid="margin">{order.margin ? `${money(order.margin.marginMinor)}${order.margin.marginPct != null ? ` (${order.margin.marginPct}%)` : ""}` : "—"}</td></tr>
          </tbody>
        </table>
        <p className="text-xs text-mute">
          {METHOD[order.paymentMethod]}{order.paymentSummary && order.paymentSummary !== METHOD[order.paymentMethod] ? ` · ${order.paymentSummary}` : ""}{order.stripePaymentIntentId ? ` · ${order.stripePaymentIntentId}` : ""}
        </p>
      </FormSection>

      {canWrite && (
        <FormSection title="Status do pedido" description="“Produto comprado no fornecedor” é marcado sozinho ao registrar a primeira compra. O pagamento só é confirmado pelo Stripe.">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Status" htmlFor="o-status">
              <select id="o-status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {ORDER_STATUSES.map((st) => (
                  <option key={st} value={st} disabled={!adminCanSetStatus(st) && st !== order.status}>{ADMIN_STATUS_LABEL[st]}</option>
                ))}
              </select>
            </Field>
            <button type="button" className={btnPrimary} disabled={pending || status === order.status} onClick={() => run(() => updateOrderStatus({ orderId: order.id, status, expected: order.status, note: "" }), { success: "Status atualizado.", onSuccess: () => router.refresh() })}>
              Salvar status
            </button>
          </div>
        </FormSection>
      )}

      {canRefund && paid && refundable > 0 && (
        <FormSection title="Reembolso" description={order.paymentMethod === "boleto" ? "Boleto não pode ser reembolsado pelo Stripe: devolva por Pix/transferência e registre aqui como “reembolsado por fora”." : "O valor volta para o cartão/Pix do cliente pelo Stripe."}>
          <div className="grid gap-4 md:grid-cols-[160px_1fr_auto] md:items-end">
            <Field label="Valor (R$)" htmlFor="rf-amount">
              <input id="rf-amount" inputMode="decimal" className={inputCls} value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} />
            </Field>
            <Field label="Observação (opcional)" htmlFor="rf-note">
              <input id="rf-note" className={inputCls} value={refund.note} onChange={(e) => setRefund({ ...refund, note: e.target.value })} />
            </Field>
            <ConfirmButton
              label="Reembolsar"
              className={btnPrimary}
              disabled={pending}
              title={`Reembolsar R$ ${refund.amount || "0,00"}?`}
              description={refund.manual ? "O reembolso será registrado como feito por fora (Pix/transferência). Esta ação não pode ser desfeita." : "O valor será devolvido ao cliente pelo Stripe. Esta ação não pode ser desfeita."}
              confirmLabel="Reembolsar"
              onConfirm={() => run(() => refundOrder({ orderId: order.id, ...refund }), { success: "Reembolso registrado.", onSuccess: () => router.refresh() })}
            />
          </div>
          <Toggle checked={refund.manual} disabled={order.paymentMethod === "boleto"} onChange={(manual) => setRefund({ ...refund, manual })} label="Reembolsado por fora (Pix/transferência)" />
          <p className="text-xs text-mute">Máximo: {money(refundable)}</p>
        </FormSection>
      )}

      {canWrite && <InvoiceSection orderId={order.id} hasInvoice={!!order.invoicePath} path={order.invoicePath} onSaved={() => router.refresh()} />}

      {order.returns.length > 0 && (
        <FormSection title="Devoluções e suporte">
          <div className="space-y-4">
            {order.returns.map((r) => <ReturnCard key={r.id} r={r} canWrite={canWrite} onSaved={() => router.refresh()} />)}
          </div>
        </FormSection>
      )}

      <FormSection title="Histórico">
        <ol className="space-y-2 text-sm" data-testid="history">
          {order.events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="tabular w-36 shrink-0 text-xs text-mute">{new Date(e.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</span>
              <span>
                {EVENT[e.kind] ?? e.kind}
                <span className="text-mute"> · {e.actor === "admin" ? "você/equipe" : e.actor === "stripe" ? "Stripe" : e.actor === "customer" ? "cliente" : "sistema"}</span>
                {e.kind === "status_changed" && e.data && typeof e.data === "object" && "to" in e.data && <span className="text-mute"> → {ADMIN_STATUS_LABEL[(e.data as { to: keyof typeof ADMIN_STATUS_LABEL }).to] ?? ""}</span>}
              </span>
            </li>
          ))}
        </ol>
      </FormSection>
    </div>
  );
}

function ItemForm({ item, suppliers, canWrite, onSaved }: { item: Order["items"][number]; suppliers: { id: string; name: string }[]; canWrite: boolean; onSaved: () => void }) {
  const { pending, run } = useAdminAction();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [v, setV] = useState({
    supplierId: item.supplierId ?? item.suggestion?.supplierId ?? "",
    supplierCost: toInput(item.supplierCostMinor),
    supplierOrderRef: item.supplierOrderRef ?? "",
    supplierUrl: item.supplierUrl ?? "",
    trackingCarrier: item.trackingCarrier ?? "",
    trackingCode: item.trackingCode ?? "",
    trackingUrl: item.trackingUrl ?? "",
    purchased: !!item.purchasedAt,
  });
  const err = (k: string) => errors[k];
  return (
    <fieldset className="space-y-4 panel p-4" data-testid="order-item" disabled={!canWrite}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <legend className="font-semibold">{item.quantity}× {item.name} <span className="font-normal text-mute">· vendido por {money(item.lineTotalMinor)}</span></legend>
        {item.purchasedAt && <span className="tag tag-solid">Comprado</span>}
      </div>
      {item.suggestion && (
        <p className="text-sm text-mute">
          Fornecedor sugerido: <span className="text-black">{item.suggestion.name}</span>
          {item.suggestion.url && <> · <a href={item.suggestion.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">abrir link do fornecedor <ExternalLink className="size-3" /></a></>}
          {item.suggestion.costMinor != null && <> · custo previsto {money(item.suggestion.costMinor)}</>}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Onde comprei" htmlFor={`it-sup-${item.id}`} error={err("supplierId")}>
          <select id={`it-sup-${item.id}`} className={inputCls} value={v.supplierId} onChange={(e) => setV({ ...v, supplierId: e.target.value })}>
            <option value="">Escolha…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Quanto paguei (R$)" htmlFor={`it-cost-${item.id}`} error={err("supplierCost")}>
          <input id={`it-cost-${item.id}`} inputMode="decimal" className={inputCls} value={v.supplierCost} onChange={(e) => setV({ ...v, supplierCost: e.target.value })} />
        </Field>
        <Field label="Nº do pedido no fornecedor" htmlFor={`it-ref-${item.id}`}>
          <input id={`it-ref-${item.id}`} className={inputCls} value={v.supplierOrderRef} onChange={(e) => setV({ ...v, supplierOrderRef: e.target.value })} />
        </Field>
      </div>
      <Field label="Link da compra" htmlFor={`it-url-${item.id}`} error={err("supplierUrl")}>
        <input id={`it-url-${item.id}`} className={inputCls} placeholder="https://" value={v.supplierUrl} onChange={(e) => setV({ ...v, supplierUrl: e.target.value })} />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Transportadora" htmlFor={`it-car-${item.id}`}>
          <input id={`it-car-${item.id}`} className={inputCls} placeholder="Correios" value={v.trackingCarrier} onChange={(e) => setV({ ...v, trackingCarrier: e.target.value })} />
        </Field>
        <Field label="Código de rastreio" htmlFor={`it-trk-${item.id}`}>
          <input id={`it-trk-${item.id}`} className={`${inputCls} font-mono`} value={v.trackingCode} onChange={(e) => setV({ ...v, trackingCode: e.target.value })} />
        </Field>
        <Field label="Link de rastreio (opcional)" htmlFor={`it-turl-${item.id}`} error={err("trackingUrl")}>
          <input id={`it-turl-${item.id}`} className={inputCls} placeholder="https://" value={v.trackingUrl} onChange={(e) => setV({ ...v, trackingUrl: e.target.value })} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Toggle checked={v.purchased} onChange={(purchased) => setV({ ...v, purchased })} label="Comprado no fornecedor" />
        {canWrite && (
          <button
            type="button"
            className={btnPrimary}
            disabled={pending}
            onClick={() => {
              setErrors({});
              run(() => updateOrderItem({ itemId: item.id, ...v }), { success: "Item salvo.", onSuccess: onSaved, onError: (r) => setErrors(r.fieldErrors ?? {}) });
            }}
          >
            Salvar item
          </button>
        )}
      </div>
    </fieldset>
  );
}

function InvoiceSection({ orderId, hasInvoice, path, onSaved }: { orderId: string; hasInvoice: boolean; path: string | null; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <FormSection title="Nota fiscal" description="Opcional para MEI em vendas a pessoa física. Anexe o PDF quando emitir; o cliente baixa em Meus pedidos.">
      <div className="flex flex-wrap items-center gap-3">
        {hasInvoice && path && (
          <button type="button" className={btnSecondary} onClick={async () => { const url = await adminFileUrl("invoices", path); if (url) window.open(url, "_blank", "noopener"); }}>
            Ver nota anexada
          </button>
        )}
        <label className={`${btnSecondary} cursor-pointer`}>
          {busy ? "Enviando…" : hasInvoice ? "Substituir nota (PDF)" : "Anexar nota fiscal (PDF)"}
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              const fd = new FormData();
              fd.set("orderId", orderId);
              fd.set("file", f);
              const r = await attachInvoice(fd);
              setBusy(false);
              if (r.ok) {
                toast.success("Nota anexada.");
                onSaved();
              } else toast.error(r.error ?? "Falha ao enviar.");
            }}
          />
        </label>
      </div>
    </FormSection>
  );
}

function ReturnCard({ r, canWrite, onSaved }: { r: Order["returns"][number]; canWrite: boolean; onSaved: () => void }) {
  const { pending, run } = useAdminAction();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [v, setV] = useState({ outcome: "refund_full", note: "", refundAmount: "" });
  const resolve = () => {
    setErrors({});
    run(() => resolveReturn({ returnId: r.id, ...v }), { success: "Solicitação resolvida.", onSuccess: onSaved, onError: (x) => setErrors(x.fieldErrors ?? {}) });
  };
  const REASON: Record<string, string> = { withdrawal: "Desistência", defect: "Defeito", other: "Outro" };
  const OUTCOME: Record<string, string> = { refund_full: "Reembolso total", refund_partial: "Reembolso parcial", replacement: "Troca", refused: "Recusada" };
  return (
    <div className="space-y-3 panel p-4" data-testid="return-card">
      <p className="text-sm">
        <span className="font-medium">{REASON[r.reason] ?? r.reason}</span> · {new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })} ·{" "}
        {r.status === "open" ? "Aberta" : `Resolvida: ${OUTCOME[r.outcome ?? ""] ?? ""}`}
      </p>
      <p className="whitespace-pre-line text-sm text-mute">{r.message}</p>
      {r.photo_paths.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {r.photo_paths.map((p, i) => (
            <button key={p} type="button" className={btnSecondary} onClick={async () => { const url = await adminFileUrl("returns", p); if (url) window.open(url, "_blank", "noopener"); }}>
              Foto {i + 1}
            </button>
          ))}
        </div>
      )}
      {r.status === "open" && canWrite && (
        <div className="grid gap-3 md:grid-cols-[200px_1fr_140px_auto] md:items-end">
          <Field label="Resultado" htmlFor={`rr-o-${r.id}`}>
            <select id={`rr-o-${r.id}`} className={inputCls} value={v.outcome} onChange={(e) => setV({ ...v, outcome: e.target.value })}>
              {Object.entries(OUTCOME).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Mensagem para o cliente" htmlFor={`rr-n-${r.id}`} error={errors.note}>
            <textarea id={`rr-n-${r.id}`} rows={1} className={textareaCls} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
          </Field>
          <Field label="Valor (parcial)" htmlFor={`rr-a-${r.id}`} error={errors.refundAmount}>
            <input id={`rr-a-${r.id}`} inputMode="decimal" className={inputCls} disabled={v.outcome !== "refund_partial"} value={v.refundAmount} onChange={(e) => setV({ ...v, refundAmount: e.target.value })} />
          </Field>
          {v.outcome === "refund_full" || v.outcome === "refund_partial" ? (
            // a refund outcome moves money: same confirmation step as "Reembolsar"
            <ConfirmButton
              label="Resolver"
              className={btnPrimary}
              disabled={pending}
              title={v.outcome === "refund_full" ? "Resolver com reembolso total?" : `Resolver com reembolso de R$ ${v.refundAmount || "0,00"}?`}
              description="O valor será devolvido ao cliente (pelo Stripe, ou registrado como feito por fora no boleto) e o cliente recebe a resposta por e-mail. Esta ação não pode ser desfeita."
              confirmLabel="Resolver e reembolsar"
              onConfirm={resolve}
            />
          ) : (
            <button type="button" className={btnPrimary} disabled={pending} onClick={resolve}>
              Resolver
            </button>
          )}
        </div>
      )}
      {r.outcome_note && <p className="text-xs text-mute">Resposta: {r.outcome_note}</p>}
    </div>
  );
}
