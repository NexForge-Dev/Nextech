import { describe, it, expect, beforeEach } from "vitest";
import { addToLocalCart, clearLocalCart, getLocalCart, parseCart, removeFromLocalCart, setLocalCartQuantity } from "@/lib/cart/local-cart";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  (globalThis as unknown as { window: EventTarget }).window = new EventTarget();
});

describe("local cart", () => {
  it("adds a product and increments the quantity", () => {
    addToLocalCart(A);
    addToLocalCart(A, 2);
    expect(getLocalCart()).toEqual([{ productId: A, quantity: 3 }]);
  });
  it("caps the quantity at 10", () => {
    addToLocalCart(A, 8);
    addToLocalCart(A, 5);
    expect(getLocalCart()[0].quantity).toBe(10);
  });
  it("sets and removes lines", () => {
    addToLocalCart(A);
    addToLocalCart(B);
    setLocalCartQuantity(A, 4);
    removeFromLocalCart(B);
    expect(getLocalCart()).toEqual([{ productId: A, quantity: 4 }]);
    setLocalCartQuantity(A, 0);
    expect(getLocalCart()).toEqual([]);
  });
  it("clears the cart", () => {
    addToLocalCart(A);
    clearLocalCart();
    expect(getLocalCart()).toEqual([]);
  });
  it("ignores corrupt or hostile storage", () => {
    expect(parseCart("not json")).toEqual([]);
    expect(parseCart(JSON.stringify([{ productId: "x", quantity: 1 }, { productId: A, quantity: 99 }, { productId: B, quantity: -1 }]))).toEqual([{ productId: A, quantity: 10 }]);
  });
});
