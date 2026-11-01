import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** Request-scoped client acting as the signed-in user (RLS applies). */
export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // called from a Server Component — the proxy refreshes the session instead
        }
      },
    },
  });
}

/** Cookie-less anonymous client, safe inside unstable_cache (public data only). */
export function createAnonSupabase() {
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: () => {} } });
}
