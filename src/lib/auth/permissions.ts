export const PERMISSIONS = [
  "products.write", "products.delete", "products.import", "links.write", "links.delete", "stores.write",
  "categories.write", "brands.write", "networks.read", "networks.write", "marketing.write", "analytics.read",
  "conversions.import", "customers.read", "customers.export", "settings.write", "admins.write", "audit.read",
  "orders.read", "orders.write", "orders.refund",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type RoleKey = "superadmin" | "admin" | "editor";

export const ROLE_LABELS: Record<RoleKey, string> = { superadmin: "Superadministrador", admin: "Administrador", editor: "Editor" };

export type AdminContext = { userId: string; email: string; role: RoleKey; permissions: Set<Permission> };

export class ForbiddenError extends Error {
  constructor(public readonly permission?: Permission) {
    super(permission ? `forbidden: ${permission}` : "forbidden");
    this.name = "ForbiddenError";
  }
}

export function isPermission(p: string): p is Permission {
  return (PERMISSIONS as readonly string[]).includes(p);
}

export function can(ctx: Pick<AdminContext, "permissions"> | null | undefined, p: Permission): boolean {
  return !!ctx && ctx.permissions.has(p);
}

export function buildAdminContext(
  user: { id: string; email: string },
  row: { role_key: string; permissions: string[]; active: boolean } | null | undefined,
): AdminContext | null {
  if (!row || !row.active) return null;
  if (!["superadmin", "admin", "editor"].includes(row.role_key)) return null;
  return { userId: user.id, email: user.email, role: row.role_key as RoleKey, permissions: new Set(row.permissions.filter(isPermission)) };
}

export async function requirePermissionWith(load: () => Promise<AdminContext | null>, p: Permission): Promise<AdminContext> {
  const ctx = await load();
  if (!ctx || !ctx.permissions.has(p)) throw new ForbiddenError(p);
  return ctx;
}
