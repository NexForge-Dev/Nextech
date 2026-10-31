import "server-only";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { buildAdminContext, requirePermissionWith, type AdminContext, type Permission } from "./permissions";

export const getSessionUser = cache(async (): Promise<{ id: string; email: string } | null> => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
});

export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("my_admin_context");
  return buildAdminContext(user, data?.[0]);
});

export function requirePermission(p: Permission): Promise<AdminContext> {
  return requirePermissionWith(getAdminContext, p);
}

export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new (await import("./permissions")).ForbiddenError();
  return ctx;
}
