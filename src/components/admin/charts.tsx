"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/*
 * Monochrome charts (brand rule: black/white/greys only). Single-series charts need no legend;
 * the multi-series commissions chart separates series by shade + dash pattern + a legend, and every
 * chart has a table view so nothing depends on colour.
 */
const INK = "#000000";
const MUTE = "#777777";
const LINE = "#e5e5e5";
const tick = { fill: MUTE, fontSize: 11 };

function shortDay(d: string) {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

function ChartFrame({ title, total, empty, children, table }: { title: string; total?: string; empty: boolean; children: React.ReactNode; table: React.ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="panel min-w-0 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {total && <p className="tabular mt-0.5 text-xs text-mute">{total}</p>}
        </div>
        {!empty && (
          <button type="button" onClick={() => setShowTable((s) => !s)} className="cursor-pointer text-xs text-mute underline-offset-2 hover:text-black hover:underline">
            {showTable ? "Ver gráfico" : "Ver tabela"}
          </button>
        )}
      </div>
      {empty ? <p className="grid h-48 place-items-center rounded-md bg-soft text-sm text-mute">Sem dados ainda</p> : showTable ? <div className="max-h-64 overflow-y-auto">{table}</div> : children}
    </section>
  );
}

function SimpleTable({ rows, valueLabel, format }: { rows: { label: string; value: number }[]; valueLabel: string; format?: (v: number) => string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-mute">
          <th className="py-1.5 font-medium">Item</th>
          <th className="py-1.5 text-right font-medium">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-line last:border-0">
            <td className="py-1.5">{r.label}</td>
            <td className="tabular py-1.5 text-right">{format ? format(r.value) : r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TooltipBox({ active, payload, label, format }: { active?: boolean; payload?: { name?: string; value?: number; stroke?: string; strokeDasharray?: string }[]; label?: string; format?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-[var(--shadow-card)]">
      <p className="mb-1 font-medium">{label && /^\d{4}-\d{2}-\d{2}$/.test(label) ? shortDay(label) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="tabular flex justify-between gap-4">
          <span className="text-mute">{p.name}</span>
          <span>{format ? format(Number(p.value)) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function DailyLine({ title, data, valueLabel }: { title: string; data: { label: string; value: number }[]; valueLabel: string }) {
  const total = data.reduce((n, p) => n + p.value, 0);
  return (
    <ChartFrame title={title} total={`${total} no período`} empty={total === 0} table={<SimpleTable rows={data.map((d) => ({ label: shortDay(d.label), value: d.value }))} valueLabel={valueLabel} />}>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={LINE} vertical={false} />
            <XAxis dataKey="label" tickFormatter={shortDay} tick={tick} axisLine={{ stroke: LINE }} tickLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
            <Tooltip content={<TooltipBox />} cursor={{ stroke: MUTE, strokeDasharray: "3 3" }} />
            <Line isAnimationActive={false} type="monotone" dataKey="value" name={valueLabel} stroke={INK} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 2, fill: INK }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function RankBar({ title, data, valueLabel }: { title: string; data: { label: string; value: number }[]; valueLabel: string }) {
  const rows = data.filter((d) => d.value > 0).slice(0, 8);
  return (
    <ChartFrame title={title} empty={rows.length === 0} table={<SimpleTable rows={rows} valueLabel={valueLabel} />}>
      <div style={{ height: Math.max(96, rows.length * 30 + 16) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }} barCategoryGap={8}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="label" width={150} tick={{ ...tick, fill: "#222222" }} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)} />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "#f7f7f7" }} />
            <Bar isAnimationActive={false} barSize={14} dataKey="value" name={valueLabel} fill={INK} radius={[0, 4, 4, 0]} label={{ position: "right", fill: "#222222", fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

const STATUS_STYLE = {
  confirmed: { name: "Confirmadas", stroke: INK, dash: undefined },
  pending: { name: "Estimadas (pendentes)", stroke: "#222222", dash: "6 4" },
  rejected: { name: "Rejeitadas", stroke: MUTE, dash: "2 3" },
} as const;

export function CommissionsChart({ points, days }: { points: { day: string; status: string; currency: string; amountMinor: number }[]; days: string[] }) {
  const currencies = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of points) totals.set(p.currency, (totals.get(p.currency) ?? 0) + p.amountMinor);
    return [...totals].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [points]);
  const [currency, setCurrency] = useState(currencies[0] ?? "BRL");
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v / 100);
  const data = days.map((d) => {
    const row: Record<string, number | string> = { label: d, confirmed: 0, pending: 0, rejected: 0 };
    for (const p of points) if (p.day === d && p.currency === currency) row[p.status] = (row[p.status] as number) + p.amountMinor;
    return row;
  });
  const empty = points.length === 0;
  return (
    <ChartFrame
      title="Evolução das comissões"
      total={currencies.length > 1 ? "Valores por moeda — sem conversão" : undefined}
      empty={empty}
      table={
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-mute">
              <th className="py-1.5 font-medium">Dia</th>
              {Object.values(STATUS_STYLE).map((s) => <th key={s.name} className="py-1.5 text-right font-medium">{s.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.filter((r) => Number(r.confirmed) || Number(r.pending) || Number(r.rejected)).map((r) => (
              <tr key={String(r.label)} className="border-b border-line last:border-0">
                <td className="py-1.5">{shortDay(String(r.label))}</td>
                <td className="tabular py-1.5 text-right">{fmt(Number(r.confirmed))}</td>
                <td className="tabular py-1.5 text-right">{fmt(Number(r.pending))}</td>
                <td className="tabular py-1.5 text-right">{fmt(Number(r.rejected))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {currencies.length > 1 && (
        <div className="mb-3 flex gap-1" role="group" aria-label="Moeda">
          {currencies.map((c) => (
            <button key={c} type="button" aria-pressed={c === currency} onClick={() => setCurrency(c)} className={`h-7 cursor-pointer rounded-md border px-2.5 text-xs ${c === currency ? "border-black bg-black text-white" : "border-line hover:bg-soft"}`}>
              {c}
            </button>
          ))}
        </div>
      )}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={LINE} vertical={false} />
            <XAxis dataKey="label" tickFormatter={shortDay} tick={tick} axisLine={{ stroke: LINE }} tickLine={false} minTickGap={24} />
            <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmt(v).replace(/,\d{2}$/, "")} width={72} />
            <Tooltip content={<TooltipBox format={fmt} />} cursor={{ stroke: MUTE, strokeDasharray: "3 3" }} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, color: "#222222" }} />
            {(Object.keys(STATUS_STYLE) as (keyof typeof STATUS_STYLE)[]).map((k) => (
              <Line isAnimationActive={false} key={k} type="monotone" dataKey={k} name={STATUS_STYLE[k].name} stroke={STATUS_STYLE[k].stroke} strokeDasharray={STATUS_STYLE[k].dash} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 2, fill: STATUS_STYLE[k].stroke }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel h-full p-4 md:p-5">
      <p className="text-[13px] text-mute">{label}</p>
      <p className="tabular mt-1.5 text-2xl font-semibold tracking-[-0.02em]">{value}</p>
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
    </div>
  );
}
