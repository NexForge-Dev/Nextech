import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

/** Remove rows created by DB tests so the local store isn't polluted (demo data is kept). */
export default async function teardown() {
  config({ path: ".env.local" });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) return;
  const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await svc.from("products").delete().like("slug", "p-%");
  await svc.from("categories").delete().like("slug", "cat-%");
  await svc.from("site_settings").delete().in("key", ["public.test_flag", "ops.test_secret"]);
  await svc.from("affiliate_networks").delete().eq("key", "rls-net");
}
