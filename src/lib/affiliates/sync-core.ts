import type { ConversionStatus, NormalizedConversion } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ExistingRow = { status: ConversionStatus; amountMinor: number | null };
export type PlannedRow = NormalizedConversion & { clickId: string | null; change: "insert" | "update" | "same" };

/** Decide inserts/updates for an idempotent upsert keyed by (network, external_id). */
export function planSync(items: NormalizedConversion[], existing: Map<string, ExistingRow>, knownClicks: Set<string>): { rows: PlannedRow[]; inserted: number; updated: number } {
  let inserted = 0;
  let updated = 0;
  const seen = new Set<string>();
  const rows: PlannedRow[] = [];
  for (const c of items) {
    if (seen.has(c.externalId)) continue;
    seen.add(c.externalId);
    const prev = existing.get(c.externalId);
    const change: PlannedRow["change"] = !prev ? "insert" : prev.status !== c.status || prev.amountMinor !== c.commissionMinor ? "update" : "same";
    if (change === "insert") inserted++;
    if (change === "update") updated++;
    const clickId = c.clickRef && UUID.test(c.clickRef) && knownClicks.has(c.clickRef.toLowerCase()) ? c.clickRef.toLowerCase() : null;
    rows.push({ ...c, clickId, change });
  }
  return { rows, inserted, updated };
}
