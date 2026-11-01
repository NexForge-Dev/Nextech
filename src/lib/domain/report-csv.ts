import { guardCell } from "./csv";

type Cell = string | number | null | undefined;

function cell(v: Cell, sep: string): string {
  if (v == null) return "";
  const s = guardCell(String(v));
  return /["\r\n]/.test(s) || s.includes(sep) || s !== String(v) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Excel-friendly CSV (pt-BR): UTF-8 BOM, ";" separator, CRLF, injection-guarded cells. */
export function toCsv(rows: Record<string, Cell>[], columns: { key: string; header: string }[], sep = ";"): string {
  const lines = [columns.map((c) => cell(c.header, sep)).join(sep), ...rows.map((r) => columns.map((c) => cell(r[c.key], sep)).join(sep))];
  return `﻿${lines.join("\r\n")}\r\n`;
}
