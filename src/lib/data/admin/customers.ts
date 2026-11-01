import "server-only";
import { createServiceSupabase } from "@/lib/supabase/service";

export type CustomerRow = { id: string; name: string | null; email: string; createdAt: string; lastSignIn: string | null; favorites: number; isAdmin: boolean };

/** Registered store customers. Server-only (service role) — callers must check customers.read first. */
export async function listCustomers(opts: { q?: string; page: number; pageSize: number }): Promise<{ rows: CustomerRow[]; total: number }> {
  const svc = createServiceSupabase();
  const users: { id: string; email?: string; created_at: string; last_sign_in_at?: string | null }[] = [];
  for (let page = 1; page < 100; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const [{ data: profiles }, { data: favs }, { data: admins }] = await Promise.all([
    svc.from("profiles").select("id, full_name"),
    svc.from("favorites").select("user_id"),
    svc.from("admin_users").select("user_id"),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const favCount = new Map<string, number>();
  for (const f of favs ?? []) favCount.set(f.user_id, (favCount.get(f.user_id) ?? 0) + 1);
  const adminIds = new Set((admins ?? []).map((a) => a.user_id));
  const q = opts.q?.trim().toLowerCase();
  const all = users
    .map((u) => ({ id: u.id, name: names.get(u.id) ?? null, email: u.email ?? "", createdAt: u.created_at, lastSignIn: u.last_sign_in_at ?? null, favorites: favCount.get(u.id) ?? 0, isAdmin: adminIds.has(u.id) }))
    .filter((u) => !q || u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { rows: all.slice((opts.page - 1) * opts.pageSize, opts.page * opts.pageSize), total: all.length };
}
