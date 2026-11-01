const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Which locally saved favorites still need to be inserted for the account (dedupe, valid ids, cap 500). */
export function mergeFavorites(local: string[], remote: string[]): { toInsert: string[] } {
  const have = new Set(remote);
  const out: string[] = [];
  for (const id of local) {
    if (typeof id !== "string" || !UUID.test(id) || have.has(id) || out.includes(id)) continue;
    out.push(id);
    if (have.size + out.length >= 500) break;
  }
  return { toInsert: out };
}
