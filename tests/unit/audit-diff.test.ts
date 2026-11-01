import { describe, it, expect } from "vitest";
import { auditDiff } from "@/lib/admin/audit-diff";

describe("auditDiff", () => {
  it("lists changed keys and redacts secrets", () => {
    const d = auditDiff({ a: 1, token: "x", b: 2 }, { a: 2, token: "y", b: 2 });
    expect(d.changed).toEqual(["a", "token"]);
    expect(d.before).toEqual({ a: 1, token: "[redacted]" });
    expect(d.after).toEqual({ a: 2, token: "[redacted]" });
  });
  it("handles creation", () => {
    const d = auditDiff(null, { name: "X", password: "p" });
    expect(d.changed).toEqual(["name", "password"]);
    expect(d.after).toEqual({ name: "X", password: "[redacted]" });
  });
  it("handles deletion", () => expect(auditDiff({ name: "X" }, null).changed).toEqual(["name"]));
  it("compares nested values structurally", () => expect(auditDiff({ specs: [{ a: 1 }] }, { specs: [{ a: 1 }] }).changed).toEqual([]));
  it("truncates long strings", () => {
    const d = auditDiff(null, { description: "x".repeat(1000) });
    expect(String(d.after?.description).length).toBeLessThanOrEqual(203);
  });
});
