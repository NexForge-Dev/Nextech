import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import teardown from "./global-teardown";

const LEGAL = { company_name: "Loja Teste Ltda", tax_id: "00.000.000/0001-00", address: "Rua Teste, 1, São Paulo/SP" };

/** create_order_from_cart refuses to sell until the seller is identified (0032). */
export default async function setup() {
  config({ path: ".env.local", quiet: true });
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
  const { error } = await svc.from("site_settings").upsert({ key: "public.legal", value: LEGAL }, { onConflict: "key" });
  if (error) throw error;
  return teardown;
}
