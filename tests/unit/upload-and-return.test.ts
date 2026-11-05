import { describe, it, expect, vi } from "vitest";
import { hasImageSignature } from "@/lib/security/image-signature";
import { isDeclinedPayment } from "@/lib/orders/declined";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(12).fill(0)]);
const text = new TextEncoder().encode("isto nao e uma imagem");

describe("hasImageSignature", () => {
  it("accepts real signatures", () => {
    expect(hasImageSignature(bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg")).toBe(true);
    expect(hasImageSignature(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "image/png")).toBe(true);
    expect(hasImageSignature(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50), "image/webp")).toBe(true);
  });
  it("refuses a text file renamed to .png, and a PNG declared as JPEG", () => {
    expect(hasImageSignature(text, "image/png")).toBe(false);
    expect(hasImageSignature(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "image/jpeg")).toBe(false);
  });
});

describe("isDeclinedPayment", () => {
  it("is true only when Stripe says an attempt failed", () => {
    expect(isDeclinedPayment({ status: "requires_payment_method", last_payment_error: { code: "card_declined" } })).toBe(true);
  });
  it("a crafted link on an untouched payment, or one in progress, is not a decline", () => {
    expect(isDeclinedPayment({ status: "requires_payment_method", last_payment_error: null })).toBe(false);
    expect(isDeclinedPayment({ status: "processing" })).toBe(false);
    expect(isDeclinedPayment({ status: "succeeded" })).toBe(false);
  });
});

describe("GET /api/health", () => {
  it("answers 503 when the database cannot be reached, 200 when it can", async () => {
    let dbError: unknown = null;
    vi.doMock("@/lib/supabase/service", () => ({ createServiceSupabase: () => ({ from: () => ({ select: () => ({ limit: async () => ({ error: dbError }) }) }) }) }));
    const { GET } = await import("@/app/api/health/route");
    expect((await GET()).status).toBe(200);
    dbError = new Error("down");
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, db: false });
    vi.doUnmock("@/lib/supabase/service");
  });
});
