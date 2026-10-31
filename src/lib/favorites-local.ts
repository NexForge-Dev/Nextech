const KEY = "nx_favorites";
const EVENT = "nx-favorites-change";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getLocalFavorites(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 500) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Toggle a product; returns true when it is now a favorite. */
export function toggleLocalFavorite(id: string): boolean {
  const ids = getLocalFavorites();
  const has = ids.includes(id);
  write(has ? ids.filter((x) => x !== id) : [id, ...ids].slice(0, 500));
  return !has;
}

export function clearLocalFavorites() {
  write([]);
}

export function onFavoritesChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
