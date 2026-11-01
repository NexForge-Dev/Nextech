/** Only same-origin absolute paths are allowed as post-login redirects (blocks //host, \host, schemes). */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return null;
  try {
    const u = new URL(next, "http://n.invalid");
    if (u.host !== "n.invalid") return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}
