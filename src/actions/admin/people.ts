"use server";
import { updateTag } from "next/cache";
import { z } from "zod";
import { adminAction, ActionFailure } from "@/lib/admin/action";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { settingsSchema } from "@/lib/admin/schemas/settings";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3300";

// ---------------------------------------------------------------- settings
const saveSettingsImpl = adminAction({ permission: "settings.write", schema: settingsSchema, audit: { action: "save", entity: "site_settings" } }, async (s, ctx) => {
  const sb = await createServerSupabase();
  const rows: { key: string; value: unknown }[] = [
    { key: "public.store_name", value: s.storeName },
    { key: "public.contact_email", value: s.contactEmail },
    // jsonb column is NOT NULL: store "" for "no image" (readers treat "" as unset)
    { key: "public.logo_path", value: s.logoPath ?? "" },
    { key: "public.favicon_path", value: s.faviconPath ?? "" },
    { key: "public.hero_image", value: s.heroImage ?? "" },
    { key: "public.institutional", value: s.institutional },
    { key: "public.socials", value: s.socials },
    { key: "public.seo", value: s.seo },
    { key: "public.analytics", value: s.analytics },
    { key: "public.cookie_texts", value: s.cookieTexts },
    { key: "public.legal", value: s.legal },
    { key: "ops.price_stale_days", value: s.priceStaleDays },
  ];
  const { error } = await sb.from("site_settings").upsert(rows.map((r) => ({ key: r.key, value: r.value as never, updated_by: ctx.userId })), { onConflict: "key" });
  if (error) throw error;
  updateTag("settings");
  return { id: "settings", audit: { keys: rows.map((r) => r.key) } };
});
export async function saveSettings(input: unknown) {
  return saveSettingsImpl(input);
}

// ---------------------------------------------------------------- contact messages
const handledImpl = adminAction({ permission: "customers.read", schema: z.object({ id: z.string().uuid(), handled: z.boolean() }), audit: { action: "handled", entity: "contact_messages" } }, async ({ id, handled }) => {
  const sb = await createServerSupabase();
  const { error } = await sb.from("contact_messages").update({ handled }).eq("id", id);
  if (error) throw error;
  return { id, audit: { handled } };
});
export async function setMessageHandled(input: unknown) {
  return handledImpl(input);
}

// ---------------------------------------------------------------- administrators
const roleKey = z.enum(["superadmin", "admin", "editor"]);

async function activeSuperadmins(): Promise<string[]> {
  const svc = createServiceSupabase();
  const { data } = await svc.from("admin_users").select("user_id, admin_roles!inner(key)").eq("active", true).eq("admin_roles.key", "superadmin");
  return (data ?? []).map((r) => r.user_id);
}

const inviteImpl = adminAction({ permission: "admins.write", schema: z.object({ email: z.string().trim().toLowerCase().email("E-mail inválido."), role: roleKey }), audit: { action: "invite", entity: "admin_users" } }, async ({ email, role }, ctx) => {
  const svc = createServiceSupabase();
  const { data: r } = await svc.from("admin_roles").select("id").eq("key", role).single();
  let userId: string | undefined;
  for (let page = 1; page < 50 && !userId; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }
  let invited = false;
  if (!userId) {
    const { data, error } = await svc.auth.admin.inviteUserByEmail(email, { redirectTo: `${SITE}/auth/callback?next=${encodeURIComponent("/admin")}` });
    if (error) throw new ActionFailure("invalid", `Não foi possível enviar o convite: ${error.message}`);
    userId = data.user.id;
    invited = true;
  }
  const { error } = await svc.from("admin_users").upsert({ user_id: userId, role_id: r!.id, active: true, invited_by: ctx.userId }, { onConflict: "user_id" });
  if (error) throw error;
  return { id: userId, invited, audit: { email, role, invited } };
});
export async function inviteAdmin(input: unknown) {
  return inviteImpl(input);
}

const changeImpl = adminAction(
  { permission: "admins.write", schema: z.object({ userId: z.string().uuid(), role: roleKey.optional(), active: z.boolean().optional() }), audit: { action: "update", entity: "admin_users" } },
  async ({ userId, role, active }, ctx) => {
    if (userId === ctx.userId && (role && role !== ctx.role || active === false)) throw new ActionFailure("conflict", "Você não pode alterar o próprio perfil nem se desativar.");
    const supers = await activeSuperadmins();
    const removingSuper = supers.includes(userId) && ((role && role !== "superadmin") || active === false);
    if (removingSuper && supers.length <= 1) throw new ActionFailure("conflict", "Deve existir pelo menos um superadministrador ativo.");
    const svc = createServiceSupabase();
    const patch: { role_id?: string; active?: boolean } = {};
    if (role) patch.role_id = (await svc.from("admin_roles").select("id").eq("key", role).single()).data!.id;
    if (active !== undefined) patch.active = active;
    const { error } = await (await createServerSupabase()).from("admin_users").update(patch).eq("user_id", userId);
    if (error) throw error;
    return { id: userId, audit: { role, active } };
  },
);
export async function updateAdmin(input: unknown) {
  return changeImpl(input);
}
