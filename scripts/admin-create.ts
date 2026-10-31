/**
 * Create (or promote) an admin user.
 *   npm run admin:create -- <email> [--role superadmin|admin|editor] [--password <p>]
 * Without --password an invite email is sent (cloud) — locally you can read it in Mailpit.
 * Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment / .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const ROLES = ["superadmin", "admin", "editor"] as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = process.argv.slice(2).find((a) => !a.startsWith("--") && a.includes("@"));
  const role = (arg("role") ?? "superadmin") as (typeof ROLES)[number];
  const password = arg("password");
  if (!email) throw new Error("Usage: npm run admin:create -- <email> [--role superadmin|admin|editor] [--password <p>]");
  if (!ROLES.includes(role)) throw new Error(`Unknown role "${role}"`);
  if (password && password.length < 8) throw new Error("Password must be at least 8 characters");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const svc = createClient(url, key, { auth: { persistSession: false } });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3300";
  let userId: string | undefined;
  for (let page = 1; !userId; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 200) break;
  }

  if (!userId) {
    if (password) {
      const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      userId = data.user.id;
      console.log(`Created user ${email}`);
    } else {
      const { data, error } = await svc.auth.admin.inviteUserByEmail(email, { redirectTo: `${site}/admin/entrar` });
      if (error) throw error;
      userId = data.user.id;
      console.log(`Invited ${email} — they will receive an email to set a password`);
    }
  } else if (password) {
    const { error } = await svc.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
    console.log(`Updated password for ${email}`);
  }

  const { data: r, error: re } = await svc.from("admin_roles").select("id").eq("key", role).single();
  if (re || !r) throw re ?? new Error(`Role ${role} not found — did you run supabase/seed.sql?`);
  const { error: ue } = await svc.from("admin_users").upsert({ user_id: userId, role_id: r.id, active: true }, { onConflict: "user_id" });
  if (ue) throw ue;
  await svc.from("admin_audit_log").insert({ actor_id: null, action: "admin.bootstrap", entity: "admin_users", entity_id: userId, summary: { email, role } });
  console.log(`${email} is now ${role}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
