import "server-only";
import { redirect } from "next/navigation";
import { getAdminContext, getSessionUser } from "@/lib/auth/session";
import type { AdminContext, Permission } from "@/lib/auth/permissions";

/**
 * Page-level guard for admin pages. Unauthenticated → login; authenticated without the
 * permission (or not an admin) → "Acesso restrito". Server actions re-check via adminAction().
 */
export async function pageGuard(permission?: Permission): Promise<AdminContext> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/entrar");
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/restrito");
  if (permission && !ctx.permissions.has(permission)) redirect(`/admin/restrito?p=${encodeURIComponent(permission)}`);
  return ctx;
}
