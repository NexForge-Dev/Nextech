import { describe, it, expect } from "vitest";
import { parsePeriod } from "@/lib/domain/period";

const NOW = new Date("2026-10-31T15:00:00Z");
const sp = (s: string) => new URLSearchParams(s);

describe("parsePeriod", () => {
  it("defaults to 30 days", () => {
    const p = parsePeriod(sp(""), NOW);
    expect(p.key).toBe("30d");
    expect(Math.round((p.to.getTime() - p.from.getTime()) / 86_400_000)).toBe(30);
  });
  it("supports today in São Paulo time", () => {
    const p = parsePeriod(sp("p=today"), NOW);
    expect(p.key).toBe("today");
    expect(p.from.toISOString()).toBe("2026-10-31T03:00:00.000Z");
  });
  it("supports 7d and 90d", () => {
    expect(parsePeriod(sp("p=7d"), NOW).key).toBe("7d");
    expect(parsePeriod(sp("p=90d"), NOW).key).toBe("90d");
  });
  it("accepts a valid custom range", () => {
    const p = parsePeriod(sp("p=custom&from=2026-10-01&to=2026-10-10"), NOW);
    expect(p.key).toBe("custom");
    expect(p.from.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-10-11T02:59:59.999Z");
  });
  it("falls back to 30d for an inverted custom range", () => expect(parsePeriod(sp("p=custom&from=2026-10-10&to=2026-10-01"), NOW).key).toBe("30d"));
  it("falls back to 30d for ranges over 400 days", () => expect(parsePeriod(sp("p=custom&from=2024-01-01&to=2026-10-01"), NOW).key).toBe("30d"));
});
