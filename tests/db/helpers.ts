import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type DB = SupabaseClient<Database>;

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function assertLocal() {
  const host = new URL(URL_).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error(`DB tests refuse to run against ${host}`);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export function serviceClient(): DB {
  assertLocal();
  return createClient<Database>(URL_, SERVICE, opts);
}

export function anonClient(): DB {
  assertLocal();
  return createClient<Database>(URL_, ANON, opts);
}

const PASSWORD = "test-password-123";

export async function createUser(email: string): Promise<{ id: string; client: DB }> {
  const svc = serviceClient();
  const existing = await svc.auth.admin.listUsers({ perPage: 1000 });
  const found = existing.data.users.find((u) => u.email === email);
  if (found) await svc.auth.admin.deleteUser(found.id);
  const { data, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = anonClient();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw e2;
  return { id: data.user.id, client };
}

export async function createAdmin(email: string, role: "superadmin" | "admin" | "editor"): Promise<{ id: string; client: DB }> {
  const u = await createUser(email);
  const svc = serviceClient();
  const { data: r, error } = await svc.from("admin_roles").select("id").eq("key", role).single();
  if (error || !r) throw error ?? new Error(`role ${role} missing — run supabase db reset (seed.sql)`);
  const { error: e2 } = await svc.from("admin_users").upsert({ user_id: u.id, role_id: r.id, active: true }, { onConflict: "user_id" });
  if (e2) throw e2;
  return u;
}

let seq = 0;
export function uniq(prefix: string) {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

/** Minimal product with its own category, via the service client. */
export async function makeProduct(opts: { name: string; status?: "draft" | "published" | "archived"; locale?: "pt-BR" | "en" }) {
  const svc = serviceClient();
  const { data: cat, error: ce } = await svc.from("categories").insert({ slug: uniq("cat"), icon: "Package" }).select("id").single();
  if (ce) throw ce;
  await svc.from("category_translations").insert({ category_id: cat!.id, locale: "pt-BR", name: "Categoria Teste" });
  const slug = uniq("p");
  const { data: p, error } = await svc
    .from("products")
    .insert({ slug, category_id: cat!.id, status: opts.status ?? "published", published_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  const { error: te } = await svc.from("product_translations").insert({ product_id: p!.id, locale: opts.locale ?? "pt-BR", name: opts.name });
  if (te) throw te;
  return { id: p!.id, slug, categoryId: cat!.id };
}
