import { describe, it, expect } from "vitest";
import { parseConsent, serializeConsent, type Consent } from "@/lib/domain/consent";

const c: Consent = { v: 1, analytics: true, marketing: false, decidedAt: "2026-10-31T10:00:00.000Z" };

describe("consent cookie", () => {
  it("rejects garbage", () => expect(parseConsent("garbage")).toBeNull());
  it("rejects undefined", () => expect(parseConsent(undefined)).toBeNull());
  it("roundtrips", () => expect(parseConsent(serializeConsent(c))).toEqual(c));
  it("rejects other versions", () => expect(parseConsent(serializeConsent({ ...c, v: 2 } as unknown as Consent))).toBeNull());
  it("rejects non-boolean flags", () => expect(parseConsent(encodeURIComponent(JSON.stringify({ ...c, analytics: "yes" })))).toBeNull());
});
