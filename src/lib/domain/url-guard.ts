export type UrlCheck =
  | { ok: true; url: URL }
  | { ok: false; reason: "invalid" | "not_https" | "host_not_allowed"; host?: string };

export function normalizeHost(h: string): string {
  return h.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

function matches(host: string, domains: string[]): boolean {
  const h = normalizeHost(host);
  return domains.map(normalizeHost).some((d) => d && (h === d || h.endsWith(`.${d}`)));
}

export function hostAllowed(url: string, allowedDomains: string[]): boolean {
  const r = validateExternalUrl(url, allowedDomains);
  return r.ok;
}

/** https-only, no credentials, host must be in the allow-list (exact or subdomain) when one is given. */
export function validateExternalUrl(url: string, allowedDomains?: string[]): UrlCheck {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (u.protocol !== "https:") {
    return u.protocol === "http:" ? { ok: false, reason: "not_https" } : { ok: false, reason: "invalid" };
  }
  if (u.username || u.password || !u.hostname.includes(".")) return { ok: false, reason: "invalid" };
  if (allowedDomains && !matches(u.hostname, allowedDomains)) {
    return { ok: false, reason: "host_not_allowed", host: normalizeHost(u.hostname) };
  }
  return { ok: true, url: u };
}

export function appendParam(url: string, name: string, value: string): string {
  const u = new URL(url);
  u.searchParams.set(name, value);
  return u.toString();
}
