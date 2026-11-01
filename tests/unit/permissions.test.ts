import { describe, it, expect } from "vitest";
import { can, buildAdminContext, requirePermissionWith, ForbiddenError, type AdminContext } from "@/lib/auth/permissions";

const ctx = (perms: string[]): AdminContext => ({ userId: "u1", email: "a@b.c", role: "editor", permissions: new Set(perms) as AdminContext["permissions"] });

describe("permissions", () => {
  it("can() checks membership", () => {
    expect(can(ctx(["products.write"]), "products.delete")).toBe(false);
    expect(can(ctx(["products.write"]), "products.write")).toBe(true);
  });
  it("requirePermission rejects with ForbiddenError when missing", async () => {
    await expect(requirePermissionWith(async () => ctx(["products.write"]), "settings.write")).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("requirePermission rejects when there is no admin context", async () => {
    await expect(requirePermissionWith(async () => null, "products.write")).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("requirePermission resolves the context when allowed", async () => {
    await expect(requirePermissionWith(async () => ctx(["products.write"]), "products.write")).resolves.toMatchObject({ userId: "u1" });
  });
  it("an inactive admin user yields no context", () => {
    expect(buildAdminContext({ id: "u1", email: "a@b.c" }, { role_key: "admin", permissions: ["products.write"], active: false })).toBeNull();
  });
  it("unknown permission keys are dropped", () => {
    const c = buildAdminContext({ id: "u1", email: "a@b.c" }, { role_key: "admin", permissions: ["products.write", "evil.key"], active: true });
    expect(c && [...c.permissions]).toEqual(["products.write"]);
  });
});
