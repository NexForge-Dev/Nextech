/** Throws unless the Supabase URL points at a local stack (127.0.0.1 / localhost). */
export function assertLocalSupabase(url: string): void {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid Supabase URL: "${url}"`);
  }
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Refusing to run against a non-local Supabase (${host}). This script is for local development only.`);
  }
}
