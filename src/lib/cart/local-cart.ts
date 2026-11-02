/** Shopping cart kept in this browser. Prices are never stored: the server recomputes them. */
export type CartItem = { productId: string; quantity: number };

const KEY = "nx_cart_v1";
const EVENT = "nx-cart-change";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_QTY = 10;
const MAX_LINES = 30;

export function parseCart(raw: string | null): CartItem[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    if (!Array.isArray(v)) return [];
    const seen = new Set<string>();
    const out: CartItem[] = [];
    for (const x of v) {
      if (!x || typeof x.productId !== "string" || !UUID.test(x.productId) || seen.has(x.productId)) continue;
      const q = Math.floor(Number(x.quantity));
      if (!Number.isFinite(q) || q < 1) continue;
      seen.add(x.productId);
      out.push({ productId: x.productId, quantity: Math.min(q, MAX_QTY) });
      if (out.length >= MAX_LINES) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function getLocalCart(): CartItem[] {
  try {
    return parseCart(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function addToLocalCart(productId: string, quantity = 1) {
  const items = getLocalCart();
  const line = items.find((i) => i.productId === productId);
  if (line) line.quantity = Math.min(line.quantity + quantity, MAX_QTY);
  else items.push({ productId, quantity: Math.min(Math.max(quantity, 1), MAX_QTY) });
  write(items);
}

export function setLocalCartQuantity(productId: string, quantity: number) {
  const items = getLocalCart();
  write(quantity < 1 ? items.filter((i) => i.productId !== productId) : items.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(quantity, MAX_QTY) } : i)));
}

export function removeFromLocalCart(productId: string) {
  write(getLocalCart().filter((i) => i.productId !== productId));
}

export function clearLocalCart() {
  write([]);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

export function onCartChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
