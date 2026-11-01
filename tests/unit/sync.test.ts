import { describe, it, expect } from "vitest";
import { planSync, type ExistingRow } from "@/lib/affiliates/sync-core";
import type { NormalizedConversion } from "@/lib/affiliates/types";

const conv = (p: Partial<NormalizedConversion> = {}): NormalizedConversion => ({
  externalId: "T1",
  occurredAt: "2026-10-20T00:00:00Z",
  status: "pending",
  saleAmountMinor: 1000,
  currency: "BRL",
  commissionMinor: 50,
  clickRef: null,
  raw: {},
  ...p,
});

describe("planSync", () => {
  it("inserts new conversions", () => {
    const plan = planSync([conv()], new Map(), new Set());
    expect(plan.inserted).toBe(1);
    expect(plan.updated).toBe(0);
  });
  it("is idempotent for unchanged rows", () => {
    const existing = new Map<string, ExistingRow>([["T1", { status: "pending", amountMinor: 50 }]]);
    const plan = planSync([conv()], existing, new Set());
    expect(plan.inserted).toBe(0);
    expect(plan.updated).toBe(0);
  });
  it("counts status changes as updates", () => {
    const existing = new Map<string, ExistingRow>([["T1", { status: "pending", amountMinor: 50 }]]);
    expect(planSync([conv({ status: "confirmed" })], existing, new Set()).updated).toBe(1);
  });
  it("links a known click id", () => {
    const id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const plan = planSync([conv({ clickRef: id })], new Map(), new Set([id]));
    expect(plan.rows[0].clickId).toBe(id);
  });
  it("ignores unknown or non-uuid click refs", () => {
    expect(planSync([conv({ clickRef: "abc" })], new Map(), new Set()).rows[0].clickId).toBeNull();
  });
});
