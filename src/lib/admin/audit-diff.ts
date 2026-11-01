const SECRET = /key|secret|token|password|credential/i;

type Obj = Record<string, unknown>;

function clean(key: string, v: unknown): unknown {
  if (SECRET.test(key)) return "[redacted]";
  if (typeof v === "string" && v.length > 200) return `${v.slice(0, 200)}…`;
  return v;
}

/** Summary of what changed between two versions of a record, with secrets redacted. */
export function auditDiff(before: Obj | null, after: Obj | null): { changed: string[]; before?: Obj; after?: Obj } {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((k) => !["updated_at", "created_at"].includes(k));
  const changed = keys.filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
  const pick = (o: Obj | null) => (o ? Object.fromEntries(changed.filter((k) => k in o).map((k) => [k, clean(k, o[k])])) : undefined);
  return { changed, ...(before ? { before: pick(before) } : {}), ...(after ? { after: pick(after) } : {}) };
}
