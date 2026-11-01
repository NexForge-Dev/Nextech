export type PeriodKey = "today" | "7d" | "30d" | "90d" | "custom";
export type Period = { from: Date; to: Date; key: PeriodKey; fromDate: string; toDate: string };

/** São Paulo is UTC−3 all year (no DST since 2019). Dashboard days are counted in that zone. */
const OFFSET_H = 3;

function dayStartUtc(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + OFFSET_H * 3_600_000);
}

function ymdInZone(d: Date): string {
  return new Date(d.getTime() - OFFSET_H * 3_600_000).toISOString().slice(0, 10);
}

export function parsePeriod(sp: URLSearchParams, now: Date = new Date()): Period {
  const key = sp.get("p") as PeriodKey | null;
  const todayStart = dayStartUtc(ymdInZone(now))!;
  const mk = (from: Date, to: Date, k: PeriodKey): Period => ({ from, to, key: k, fromDate: ymdInZone(from), toDate: ymdInZone(to) });
  if (key === "today") return mk(todayStart, now, "today");
  if (key === "7d") return mk(new Date(now.getTime() - 7 * 86_400_000), now, "7d");
  if (key === "90d") return mk(new Date(now.getTime() - 90 * 86_400_000), now, "90d");
  if (key === "custom") {
    const from = dayStartUtc(sp.get("from") ?? "");
    const toStart = dayStartUtc(sp.get("to") ?? "");
    if (from && toStart && toStart >= from && toStart.getTime() - from.getTime() <= 400 * 86_400_000) {
      return mk(from, new Date(toStart.getTime() + 86_400_000 - 1), "custom");
    }
  }
  return mk(new Date(now.getTime() - 30 * 86_400_000), now, "30d");
}
