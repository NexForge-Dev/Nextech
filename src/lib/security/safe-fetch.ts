import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Loopback, private, link-local (cloud metadata), CGNAT, multicast and other non-public ranges. */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return /^(fc|fd|fe[89ab]|ff)/.test(s);
  }
  return true;
}

type Resolver = (host: string) => Promise<string[]>;
const dnsResolve: Resolver = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

/**
 * GET a public https URL for server-side imports, refusing internal targets (SSRF): every hop of a
 * redirect is re-checked (https only, no credentials, host resolving only to public addresses).
 */
export async function fetchPublicHttps(url: string, init: { timeoutMs?: number; maxRedirects?: number } = {}, deps: { fetch?: typeof fetch; resolve?: Resolver } = {}): Promise<Response | null> {
  const doFetch = deps.fetch ?? fetch;
  const resolve = deps.resolve ?? dnsResolve;
  let current = url;
  for (let hop = 0; hop <= (init.maxRedirects ?? 3); hop++) {
    let u: URL;
    try {
      u = new URL(current);
    } catch {
      return null;
    }
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const host = u.hostname.replace(/^\[|\]$/g, "");
    const addrs = isIP(host) ? [host] : await resolve(host).catch(() => [] as string[]);
    if (!addrs.length || addrs.some(isPrivateIp)) return null;
    const res = await doFetch(u, { redirect: "manual", signal: AbortSignal.timeout(init.timeoutMs ?? 10_000) });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      current = new URL(loc, u).toString();
      continue;
    }
    return res;
  }
  return null;
}
