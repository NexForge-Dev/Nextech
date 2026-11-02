import { LOCALE_PREFIX, LOCALES, pathnames, type Locale } from "./routing";

type Entry = string | Record<Locale, string>;

function toRegex(pattern: string): RegExp {
  const src = pattern.replace(/[.*+?^${}()|\\]/g, "\\$&").replace(/\[(\.\.\.)?[a-z]+\]/gi, "([^/]+)");
  return new RegExp(`^${src}$`);
}

function fill(pattern: string, values: string[]): string {
  let i = 0;
  return pattern.replace(/\[(\.\.\.)?[a-z]+\]/gi, () => values[i++] ?? "");
}

/**
 * While the storefront is locked to pt-BR (own store only, affiliates off), any URL under another
 * locale prefix is redirected to the pt-BR equivalent. Returns the target path, or null to keep the URL.
 */
export function lockedLocalePath(pathname: string): string | null {
  const ptPrefix = LOCALE_PREFIX["pt-BR"];
  const locale = LOCALES.find((l) => l !== "pt-BR" && (pathname === LOCALE_PREFIX[l] || pathname.startsWith(`${LOCALE_PREFIX[l]}/`)));
  if (!locale) return null;
  const rest = pathname.slice(LOCALE_PREFIX[locale].length).replace(/\/+$/, "") || "/";
  if (rest === "/") return ptPrefix;
  for (const entry of Object.values(pathnames) as Entry[]) {
    const from = typeof entry === "string" ? entry : entry[locale];
    const to = typeof entry === "string" ? entry : entry["pt-BR"];
    const m = toRegex(from).exec(rest);
    if (m) return `${ptPrefix}${fill(to, m.slice(1))}`;
  }
  return ptPrefix;
}
