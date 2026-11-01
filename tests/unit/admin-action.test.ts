import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { adminActionWith } from "@/lib/admin/action-core";
import type { AdminContext } from "@/lib/auth/permissions";

const ctx = (perms: string[]): AdminContext => ({ userId: "u", email: "e", role: "editor", permissions: new Set(perms) as AdminContext["permissions"] });
const schema = z.object({ name: z.string().min(2) });

describe("adminAction", () => {
  it("refuses without permission and never runs fn", async () => {
    const fn = vi.fn();
    const action = adminActionWith({ load: async () => ctx([]), audit: async () => {} }, { permission: "products.write", schema }, fn);
    expect(await action({ name: "ok" })).toEqual({ ok: false, error: "forbidden" });
    expect(fn).not.toHaveBeenCalled();
  });
  it("returns field errors for invalid input", async () => {
    const action = adminActionWith({ load: async () => ctx(["products.write"]), audit: async () => {} }, { permission: "products.write", schema }, async () => 1);
    const r = await action({ name: "x" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toBe("invalid");
    expect(r.ok === false && r.fieldErrors?.name?.length).toBeGreaterThan(0);
  });
  it("maps unique violations to conflict", async () => {
    const action = adminActionWith({ load: async () => ctx(["products.write"]), audit: async () => {} }, { permission: "products.write", schema }, async () => {
      throw Object.assign(new Error("dup"), { code: "23505" });
    });
    expect(await action({ name: "ok" })).toMatchObject({ ok: false, error: "conflict" });
  });
  it("runs fn and writes the audit log on success", async () => {
    const audit = vi.fn(async () => {});
    const action = adminActionWith({ load: async () => ctx(["products.write"]), audit }, { permission: "products.write", schema, audit: { action: "update", entity: "products" } }, async (i) => ({ id: "p1", name: i.name }));
    expect(await action({ name: "ok" })).toEqual({ ok: true, data: { id: "p1", name: "ok" } });
    expect(audit).toHaveBeenCalledOnce();
  });
  it("hides unexpected errors as server", async () => {
    const action = adminActionWith({ load: async () => ctx(["products.write"]), audit: async () => {} }, { permission: "products.write", schema }, async () => {
      throw new Error("boom");
    });
    expect(await action({ name: "ok" })).toMatchObject({ ok: false, error: "server" });
  });
});
